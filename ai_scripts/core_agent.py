import os
import sys
import json
import re
import google.generativeai as genai
from utils import scan_files, format_context_for_ai, write_files

# Configure Gemini API
API_KEY = os.environ.get('GEMINI_API_KEY')
if not API_KEY:
    print("Error: GEMINI_API_KEY not found in environment.")
    sys.exit(1)

genai.configure(api_key=API_KEY)

# Use Gemini 1.5 Pro (v1beta)
model = genai.GenerativeModel(model_name="gemini-1.5-pro")

def update_status(root_dir, status, last_command):
    """
    Updates status.json with the current engine state.
    """
    status_path = os.path.join(root_dir, 'status.json')
    from datetime import datetime
    data = {
        "status": status,
        "last_command": last_command,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    with open(status_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def run_command(command, root_dir):
    """
    Executes a user command and returns the output for AI analysis.
    """
    import subprocess
    if command.startswith("/build"):
        # Default build command (can be expanded)
        build_command = "npm run build" if os.path.exists(os.path.join(root_dir, 'package.json')) else "echo 'No build script found'"
        try:
            result = subprocess.run(build_command, shell=True, check=True, capture_output=True, text=True, cwd=root_dir)
            return True, f"Build successful:\n{result.stdout}"
        except subprocess.CalledProcessError as e:
            return False, f"Build failed:\n{e.stdout}\n{e.stderr}"
    
    return True, "No specific system command executed."

def parse_ai_response(response_text):
    """
    Parses the AI's response to extract file paths and content.
    Supports two formats:
    1. <<<FILE: path>>> content <<<END_FILE>>>
    2. FILE_PATH: [path]\nCONTENT: [content] (more robust version of the requested tag)
    """
    files = {}
    
    # Check for <<<FILE: >>> format
    pattern1 = r"<<<FILE: (.*?)>>>\n(.*?)\n<<<END_FILE>>>"
    matches1 = re.finditer(pattern1, response_text, re.DOTALL)
    for match in matches1:
        files[match.group(1).strip()] = match.group(2)

    # If nothing found, check for FILE_PATH: format
    if not files:
        pattern2 = r"FILE_PATH: (.*?)\nCONTENT: (.*?)(?=\nFILE_PATH: |\Z)"
        matches2 = re.finditer(pattern2, response_text, re.DOTALL)
        for match in matches2:
            files[match.group(1).strip()] = match.group(2).strip()

    return files

def get_tree_structure(root_dir):
    """
    Returns a directory tree structure for /src and root.
    """
    import subprocess
    target = "src" if os.path.exists(os.path.join(root_dir, "src")) else "."
    try:
        # Use simple os.walk if tree command is not available in environment
        tree_str = f"Structure of {target}:\n"
        for root, dirs, files in os.walk(os.path.join(root_dir, target)):
            level = root.replace(root_dir, '').count(os.sep)
            indent = ' ' * 4 * level
            tree_str += f"{indent}{os.path.basename(root)}/\n"
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                tree_str += f"{subindent}{f}\n"
        return tree_str
    except Exception as e:
        return f"Could not generate tree: {e}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python core_agent.py <prompt_json>")
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        user_input = input_data.get('user_input', sys.argv[1])
    except Exception:
        user_input = sys.argv[1]
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    update_status(root_dir, "processing", user_input)

    # Read instructions
    instructions = ""
    instr_path = os.path.join(root_dir, 'instructions.md')
    if os.path.exists(instr_path):
        with open(instr_path, 'r', encoding='utf-8') as f:
            instructions = f.read()

    # Get context (current source files)
    files_content = scan_files(root_dir)
    context = format_context_for_ai(files_content)

    prompt = f"""
    You are the 'AI Brain' for the ASDF Framework. 
    Current Coding Rules in instructions.md:
    {instructions}

    PROJECT CONTEXT (Current source files):
    {context}

    USER REQUEST: {user_input}

    RESPONSE REQUIREMENTS:
    1. If the user asks for changes, provide the complete new content for each updated or new file.
    2. Use this exact format for each file:
       FILE_PATH: [path/from/root/filename]
       CONTENT: [full content here]
    3. Be concise and focus on the request.
    4. If no files need updating, just acknowledge the request.
    """

    # For specialized commands
    if user_input.startswith("/tree"):
        print(get_tree_structure(root_dir))
        update_status(root_dir, "success", user_input)
        return

    if user_input.startswith("/build"):
        success, output = run_command("/build", root_dir)
        if success:
            print(f"Build Successful:\n{output}")
            update_status(root_dir, "success", user_input)
            return
        else:
            prompt += f"\n\nBuild failed with logs:\n{output}\nPlease fix the errors immediately."

    # Call AI
    try:
        response = model.generate_content(prompt)
        ai_text = response.text
        print("AI Response received.")
        
        files = parse_ai_response(ai_text)
        if files:
            write_files(root_dir, files)
            print(f"Updated {len(files)} files.")
            update_status(root_dir, "success", user_input)
        else:
            print("No file changes detected in AI response.")
            print(f"AI Text: {ai_text}")
            update_status(root_dir, "idle", user_input)

    except Exception as e:
        print(f"Error calling AI: {e}")
        update_status(root_dir, "error", user_input)
        sys.exit(1)

if __name__ == "__main__":
    main()
