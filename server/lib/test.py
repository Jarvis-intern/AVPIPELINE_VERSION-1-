import sys

def check_dependency(module_name, import_name=None):
    if import_name is None:
        import_name = module_name
    try:
        __import__(import_name)
        print(f"✅ {module_name} is installed and working")
        return True
    except ImportError as e:
        print(f"❌ {module_name} is NOT installed or not working: {e}")
        return False

success = True
success &= check_dependency("extract-msg", "extract_msg")
success &= check_dependency("pypff") or check_dependency("libpff-python", "libpff")

if success:
    print("\nAll required dependencies are installed! ✨")
    sys.exit(0)
else:
    print("\nSome dependencies are missing! Please install them using pip3 install extract-msg pypff libpff-python")
    sys.exit(1)