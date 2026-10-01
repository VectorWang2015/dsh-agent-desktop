"""Create an owned detached descendant then exit, for subreaper cleanup testing."""
import subprocess
import sys

code = "import json,os,time; from pathlib import Path; p=Path(%r); p.write_text(json.dumps({'pid':os.getpid(),'start':Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()[19]})); time.sleep(30)" % sys.argv[1]
subprocess.Popen([sys.executable, '-c', code], start_new_session=True)
