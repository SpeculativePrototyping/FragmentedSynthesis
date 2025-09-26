# textgraph/models/concat_viewer.py
from qtpy.QtWidgets import QTextEdit
from qtpynodeeditor import (
    NodeData, NodeDataType, NodeDataModel,
    PortType, NodeValidationState,
)
from ..text_data import TextData

class ConcatViewerModel(NodeDataModel):
    """
    Sink with dynamic input ports; always keeps one spare at the end.
    Uses snake_case hooks; flow_scene calls input_connection_created(connection).
    """
    name = "ConcatViewer"
    caption_visible = True

    # IMPORTANT: PortType keys, not strings
    num_ports = {PortType.input: 1, PortType.output: 0}
    port_caption_visible = True
    port_caption = {PortType.input: {0: "text[0]"}, PortType.output: {}}

    data_type = TextData.data_type

    def __init__(self, style=None, parent=None):
        super().__init__(style=style, parent=parent)

        # UI
        self._view = QTextEdit()
        self._view.setReadOnly(True)
        self._view.setPlaceholderText("Connect Text outputs…")

        # validation
        self._state = NodeValidationState.warning
        self._msg = "No text"

        # dynamic ports/data
        self._in_count = 1
        self._slots: list[str] = [""]  # latest text per input index

        # ensure per-instance dicts (defensive)
        self.port_caption = {PortType.input: {0: "text[0]"}, PortType.output: {}}
        self.num_ports = {PortType.input: 1, PortType.output: 0}

    # ----- Node API -----
    @property
    def caption(self): return self.name
    def embedded_widget(self): return self._view
    def validation_state(self): return self._state
    def validation_message(self): return self._msg

    # Data propagation (called on connect/update/disconnect with None/empty)
    def set_in_data(self, data: NodeData, port):
        idx = getattr(port, "index", None)
        if not isinstance(idx, int):
            return

        text = data.text if isinstance(data, TextData) and data.text else ""
        self._set_slot(idx, text)
        self._render_preview()
        self._ensure_spare_after(idx)
        self._compact_trailing_empties()

    # ----- Connection hooks (snake_case; 1-arg signature) -----
    def input_connection_created(self, connection):
        """Called when a connection is completed; discover the input port from the connection."""
        in_port = getattr(connection, "in_port", None) or getattr(connection, "inPort", None)
        if in_port is None:
            getter = getattr(connection, "get_in_port", None)
            in_port = getter() if callable(getter) else None

        if in_port is not None and getattr(in_port, "port_type", None) == PortType.input:
            self._ensure_spare_after(getattr(in_port, "index", 0))

    def input_connection_deleted(self, connection):
        """On detach, compress trailing empties back to one spare."""
        self._compact_trailing_empties()

    # ----- Internals -----
    def _emit_port_count_changed(self):
        sig = getattr(self, "port_count_changed", None)  # snake_case in 0.3.x
        if sig:
            try:
                sig.emit(PortType.input, self._in_count)
            except Exception:
                pass  # tolerate versions without the signal



    def _bump_inputs_to(self, new_count: int):
        print("Bumping Input tso...")
        new_count = max(1, int(new_count))
        if new_count == self._in_count:
            return
        self._in_count = new_count
        self.num_ports[PortType.input] = new_count
        for i in range(new_count):
            if i not in self.port_caption[PortType.input]:
                self.port_caption[PortType.input][i] = f"text[{i}]"
        self._emit_port_count_changed()

    def _ensure_spare_after(self, idx: int):
        # If last port was just used/connected, add one more input
        print("Gonna try to make sure we have enopugh slots")
        if idx == self._in_count - 1:
            self._slots.append("")
            self._bump_inputs_to(self._in_count + 1)

    def _compact_trailing_empties(self):
        # keep exactly one trailing empty after the last non-empty
        last_non_empty = -1
        for i, s in enumerate(self._slots):
            if s:
                last_non_empty = i
        target_len = max(1, last_non_empty + 2)  # one spare after last non-empty; or 1 if none
        if target_len != len(self._slots):
            self._slots = self._slots[:target_len]
            self._bump_inputs_to(target_len)

    def _set_slot(self, idx: int, text: str):
        if idx >= len(self._slots):
            self._slots.extend([""] * (idx + 1 - len(self._slots)))
            self._bump_inputs_to(idx + 1)
        self._slots[idx] = text or ""

    def _render_preview(self):
        parts = [s for s in self._slots if s]
        self._view.setPlainText("\n".join(parts))
        if parts:
            self._state, self._msg = NodeValidationState.valid, ""
        else:
            self._state, self._msg = NodeValidationState.warning, "No text"
