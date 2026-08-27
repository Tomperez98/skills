"""Keystroke encoder for a terminal app. Mixes IO and logic — hard to test.

Inherited from a teammate. Every test would have to fake stdin, a config
file on disk, and stdout; the real logic is buried between IO calls.
"""

import json
import os
import sys

CONFIG_PATH = os.path.expanduser("~/.myapp/config.json")


def get_mouse_state():
    """Reads raw mouse state from the system (IO)."""
    # In reality this reads /dev/input or similar; simulated here
    raw = sys.stdin.readline().strip()
    x, y, *buttons = raw.split(",")
    return {"x": int(x), "y": int(y), "buttons": buttons}


def check_mouse_state(state):
    """Functional: decide whether the mouse event should be forwarded."""
    if state["x"] < 0 or state["y"] < 0:
        raise ValueError(f"negative coordinates: {state}")
    return len(state["buttons"]) > 0


def get_keyboard_state():
    """Reads raw keyboard state from the system (IO)."""
    raw = sys.stdin.readline().strip()
    mods_part, _, key = raw.partition("|")
    return {"mods": [m for m in mods_part.split(",") if m], "key": key}


def check_keyboard_state(state):
    """Functional: validate keyboard state."""
    if not state["key"]:
        raise ValueError("empty key")
    return state


def read_setting(name):
    """Reads a setting from the config file (IO)."""
    with open(CONFIG_PATH) as f:
        config = json.load(f)
    if name not in config:
        raise KeyError(f"missing setting: {name}")
    return config[name]


def encode_key(key, mods, setting):
    """Functional core: maps a key + modifier list + setting to an escape sequence."""
    prefix = setting.get("prefix", "\x1b[")
    out = prefix + key
    for m in mods:
        out += ":" + m
    return out


def write_to_pty(data):
    """Writes encoded data to the terminal (IO)."""
    sys.stdout.write(data)
    sys.stdout.flush()


def handle_input():
    """Main entry: reads state, validates, encodes, writes."""
    mouse = get_mouse_state()
    if check_mouse_state(mouse):
        setting = read_setting("keymap")
        key = get_keyboard_state()
        check_keyboard_state(key)
        data = encode_key(key["key"], key["mods"], setting)
        write_to_pty(data)
    # else: event not forwarded, nothing happens


if __name__ == "__main__":
    handle_input()
