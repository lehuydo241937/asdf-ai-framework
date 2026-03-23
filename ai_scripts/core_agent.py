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
    
    # Generic command support? Potentially unsafe, but let's stick to simple build check.
    return True, "No specific system command executed."

def parse_ai_response(response_text):
    """
    Parses the AI's response to extract file paths and content.
    Expects format:
    <<<FILE: path/to/file>>>
    [content]
    <<<END_FILE>>>
    """
    files = {}
    pattern = r"<<<FILE: (.*?)>>>\n(.*?)\n<<<END_FILE>>>"
    matches = re.finditer(pattern, response_text, re.DOTALL)
    for match in matches:
        file_path = match.group(1).strip()
        file_content = match.group(2)
        files[file_path] = file_content
    return files

def get_tree_structure(root_dir):
    """
    Returns a directory tree structure for /src.
    """
    import subprocess
    try:
        result = subprocess.run("tree /F src", shell=True, capture_output=True, text=True, cwd=root_dir) if os.name == 'nt' else \
                 subprocess.run("find src -not -path '*/.*' -maxdepth 3", shell=True, capture_output=True, text=True, cwd=root_dir)
        return result.stdout
    except Exception as e:
        return f"Could not generate tree: {e}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python core_agent.py <prompt_json>")
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
    except Exception as e:
        print(f"Error parsing input JSON: {e}")
        sys.exit(1)

    user_input = input_data.get('user_input', '')
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
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

    PROJECT CONTEXT (Current source files in /src):
    {context}

    USER REQUEST: {user_input}

    RESPONSE REQUIREMENTS:
    1. If the user asks for changes, provide the complete new content for each updated or new file.
    2. Use this exact format for each file:
       <<<FILE: path/from/root/filename>>>
       [content]
       <<<END_FILE>>>
    3. Be concise and focus on the request.
    4. If no files need updating, just acknowledge the request.
    """

    # For specialized commands
    if user_input.startswith("/tree"):
        print(get_tree_structure(root_dir))
        return

    if user_input.startswith("/build"):
        success, output = run_command("/build", root_dir)
        if success:
            print("Build Successful")
            return
        else:
            prompt += f"\n\nBuild failed with logs:\n{output}\nPlease fix the errors."

    # Call AI
    try:
        response = model.generate_content(prompt)
        ai_text = response.text
        print("AI Response received.")
        
        # Self-correction loop (simplified)
        files = parse_ai_response(ai_text)
        if files:
            write_files(root_dir, files)
            print(f"Updated {len(files)} files.")
        else:
            print("No file changes detected in AI response.")
            print(f"AI Text: {ai_text}")

    except Exception as e:
        print(f"Error calling AI: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
