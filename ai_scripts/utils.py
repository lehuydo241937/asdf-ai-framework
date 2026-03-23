import os
import pathspec

def get_ignore_spec(root_dir):
    """
    Reads .gitignore if it exists and returns a pathspec Matcher.
    """
    ignore_file = os.path.join(root_dir, '.gitignore')
    patterns = ['.git', '__pycache__', 'node_modules', '.venv', '.env', 'status.json']
    if os.path.exists(ignore_file):
        with open(ignore_file, 'r', encoding='utf-8') as f:
            patterns.extend(f.read().splitlines())
    return pathspec.PathSpec.from_lines('gitwildmatch', patterns)

def scan_files(root_dir, target_dir='src'):
    """
    Scans files in target_dir and returns a dictionary of filename: content.
    """
    target_path = os.path.join(root_dir, target_dir)
    if not os.path.exists(target_path):
        return {}
    
    ignore_spec = get_ignore_spec(root_dir)
    files_content = {}
    
    for root, dirs, files in os.walk(target_path):
        # Filter directories based on .gitignore
        rel_root = os.path.relpath(root, root_dir)
        dirs[:] = [d for d in dirs if not ignore_spec.match_file(os.path.normpath(os.path.join(rel_root, d)))]

        for file in files:
            rel_file = os.path.relpath(os.path.join(root, file), root_dir)
            if not ignore_spec.match_file(os.path.normpath(rel_file)):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        files_content[rel_file] = f.read()
                except (UnicodeDecodeError, PermissionError):
                    # Skip binary or inaccessible files
                    continue
    
    return files_content

def format_context_for_ai(files_content):
    """
    Formats the file content dictionary into a string for the AI prompt.
    """
    context = ""
    for file_path, content in files_content.items():
        context += f"--- FILE: {file_path} ---\n{content}\n\n"
    return context

def write_files(root_dir, ai_response_files):
    """
    Writes content to files based on a dictionary of filepath: content.
    """
    for file_path, content in ai_response_files.items():
        # Ensure path is relative and within root_dir
        safe_path = os.path.normpath(os.path.join(root_dir, file_path))
        if not safe_path.startswith(os.path.abspath(root_dir)):
            print(f"Skipping potentially unsafe path: {file_path}")
            continue
            
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated file: {file_path}")
