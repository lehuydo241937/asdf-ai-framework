import os
import sys
import json
import re
import subprocess
import shutil
from google import genai
from google.genai import types
from utils import scan_files, format_context_for_ai, write_files

# Configure Gemini API
API_KEY = os.environ.get('GEMINI_API_KEY')
GH_TOKEN = os.environ.get('GH_TOKEN')

if not API_KEY or not GH_TOKEN:
    print("Error: GEMINI_API_KEY or GH_TOKEN not found.")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-1.5-pro"

def update_status(root_dir, status, last_message, current_repo="none"):
    """
    Updates status.json for real-time monitoring.
    """
    from datetime import datetime, timezone
    status_path = os.path.join(root_dir, 'status.json')
    data = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": status,
        "current_repo": current_repo,
        "last_message": last_message
    }
    with open(status_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def run_git_tasks(repo_url, target_dir, command, commit_msg):
    """
    Helper to run git commands in a target directory.
    """
    try:
        if command == "clone":
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir)
            subprocess.run(["git", "clone", repo_url, target_dir], check=True)
        elif command == "push":
            subprocess.run(["git", "config", "--global", "user.name", "ASDF-Agent"], check=True)
            subprocess.run(["git", "config", "--global", "user.email", "agent@asdf.com"], check=True)
            subprocess.run(["git", "add", "."], cwd=target_dir, check=True)
            # Check if there are changes
            diff = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=target_dir)
            if diff.returncode != 0:
                subprocess.run(["git", "commit", "-m", commit_msg], cwd=target_dir, check=True)
                subprocess.run(["git", "push"], cwd=target_dir, check=True)
                return True
            return False
    except Exception as e:
        print(f"Git Error: {e}")
        return False
    return True

def parse_ai_response(response_text):
    files = {}
    pattern = r"FILE_PATH: (.*?)\nCONTENT: (.*?)(?=\nFILE_PATH: |\Z)"
    matches = re.finditer(pattern, response_text, re.DOTALL)
    for match in matches:
        files[match.group(1).strip()] = match.group(2).strip()
    return files

def main():
    if len(sys.argv) < 2:
        print("Usage: python core_agent.py <prompt_json>")
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        user_input = input_data.get('user_input', '')
        target_repo = input_data.get('target_repo', '') # Format: owner/repo
    except Exception:
        user_input = sys.argv[1]
        target_repo = ''

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    workspace_dir = root_dir
    is_remote = False

    if target_repo and target_repo.strip() != "":
        update_status(root_dir, "processing", f"Cloning target repository: {target_repo}", target_repo)
        workspace_dir = os.path.join(root_dir, 'tmp_target')
        repo_url = f"https://x-access-token:{GH_TOKEN}@github.com/{target_repo}.git"
        if run_git_tasks(repo_url, workspace_dir, "clone", ""):
            is_remote = True
        else:
            update_status(root_dir, "error", f"Failed to clone {target_repo}", target_repo)
            sys.exit(1)

    # Read instructions and scan workspace
    update_status(root_dir, "processing", "Analyzing code context...", target_repo or "framework")
    
    files_content = scan_files(workspace_dir)
    context = format_context_for_ai(files_content)

    prompt = f"""
    You are ASDF-Agent v2.0 Control Center. 
    TARGET CONTEXT (Repository: {target_repo or 'Self'}):
    {context}

    USER REQUEST: {user_input}

    REQUIREMENTS:
    1. Respond ONLY with file changes in this format:
       FILE_PATH: [path]
       CONTENT: [code]
    2. Be precise and implement requested logic.
    """

    if user_input.startswith("/tree"):
        # Simulated tree for the workspace
        tree_out = "Current Structure:\n"
        for r, ds, fs in os.walk(workspace_dir):
            if '.git' in r: continue
            level = r.replace(workspace_dir, '').count(os.sep)
            indent = ' ' * 4 * level
            tree_out += f"{indent}{os.path.basename(r)}/\n"
            for f in fs:
                tree_out += f"{' ' * 4 * (level + 1)}{f}\n"
        print(tree_out)
        update_status(root_dir, "success", f"Structure reported for {target_repo or 'Self'}")
        return

    # AI Coding
    try:
        update_status(root_dir, "processing", "AI is writing code...", target_repo or "framework")
        response = client.models.generate_content(model=MODEL, contents=prompt)
        ai_text = response.text
        
        files = parse_ai_response(ai_text)
        if files:
            write_files(workspace_dir, files)
            update_status(root_dir, "processing", "Applying changes to repository...", target_repo or "framework")
            
            if is_remote:
                if run_git_tasks("", workspace_dir, "push", f"AI Brain: {user_input}"):
                    update_status(root_dir, "success", f"Successfully updated {target_repo}")
                else:
                    update_status(root_dir, "success", "No changes needed or error pushing.")
            else:
                update_status(root_dir, "success", "Changes applied to local framework.")
        else:
            update_status(root_dir, "idle", "No changes detected in AI response.")

    except Exception as e:
        print(f"Error: {e}")
        update_status(root_dir, "error", str(e), target_repo)
        sys.exit(1)

if __name__ == "__main__":
    main()
