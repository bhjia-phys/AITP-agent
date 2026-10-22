import sys
sys.path.insert(0, "src")
from util import damped_update
assert damped_update(0.0, 1.0, 0.5) == 0.5
print("ok")
