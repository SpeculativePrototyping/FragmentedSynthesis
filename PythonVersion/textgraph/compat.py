from qtpy import QtCore

def set_node_pos(scene, node, x, y):
    # snake_case
    try:
        return scene.set_node_position(node, QtCore.QPointF(x, y))
    except AttributeError:
        pass
    # camelCase
    try:
        return scene.setNodePosition(node, QtCore.QPointF(x, y))
    except AttributeError:
        pass
    # graphics object
    try:
        return node.graphics_object.setPos(x, y)
    except Exception:
        pass
    # last resort
    try:
        return node.setPos(x, y)
    except Exception:
        pass

def emit_port_count_changed(model, port_type, new_count):
    # qtpynodeeditor has both spellings across versions
    for sig_name in ("port_count_changed", "portCountChanged"):
        sig = getattr(model, sig_name, None)
        if sig:
            try:
                sig.emit(port_type, new_count)
                return True
            except Exception:
                pass
    return False