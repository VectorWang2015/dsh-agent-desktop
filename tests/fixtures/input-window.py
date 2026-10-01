"""Private X11 fixture: counts events, paints a known color and refuses polite close."""
import json
import os
import sys
import time
from pathlib import Path
from Xlib import X, Xatom, XK, Xutil, display

base = Path(sys.argv[1])
d = display.Display()
root = d.screen().root
window = root.create_window(80, 80, 450, 220, 0, d.screen().root_depth, X.InputOutput, X.CopyFromParent, background_pixel=0x123456, event_mask=X.KeyPressMask | X.KeyReleaseMask | X.StructureNotifyMask)
window.set_wm_name('Desktop feedback receiver')
window.set_wm_hints(flags=Xutil.InputHint, input=1)
window.change_property(d.intern_atom('_NET_WM_PID'), Xatom.CARDINAL, 32, [os.getpid()])
delete = d.intern_atom('WM_DELETE_WINDOW')
window.set_wm_protocols([delete])
window.map()
d.sync()
state = {'windowId': window.id, 'pid': os.getpid(), 'returnDown': 0, 'returnUp': 0, 'controlS': 0, 'deleteRequests': 0}


def save():
    temp = base / 'events.next.json'
    temp.write_text(json.dumps(state))
    temp.replace(base / 'events.json')


save()
end = time.monotonic() + 45
while time.monotonic() < end:
    if not d.pending_events():
        time.sleep(0.005)
        continue
    event = d.next_event()
    if event.type == X.MappingNotify:
        d.refresh_keyboard_mapping(event)
    elif event.type in (X.KeyPress, X.KeyRelease):
        symbol = d.keycode_to_keysym(event.detail, 0)
        if symbol == XK.string_to_keysym('Return'):
            state['returnDown' if event.type == X.KeyPress else 'returnUp'] += 1
        elif event.type == X.KeyPress and symbol == XK.string_to_keysym('s') and event.state & X.ControlMask:
            state['controlS'] += 1
        save()
    elif event.type == X.ClientMessage and event.client_type == d.intern_atom('WM_PROTOCOLS') and event.data[1][0] == delete:
        state['deleteRequests'] += 1
        save()  # Deliberately stay open: close requests do not prove closure.
d.close()
