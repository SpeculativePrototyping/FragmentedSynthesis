import logging
from qtpy import QtCore
from qtpy.QtWidgets import QApplication
from qtpynodeeditor import DataModelRegistry, FlowScene, FlowView, PortType
from textgraph.models import FactModel, ConcatViewerModel
from textgraph.compat import set_node_pos

def main():
    logging.basicConfig(level="INFO")
    app = QApplication([])

    reg = DataModelRegistry()
    reg.register_model(FactModel, category="Text")
    reg.register_model(ConcatViewerModel, category="Text")

    scene = FlowScene(registry=reg)
    view = FlowView(scene)
    view.setWindowTitle("Text concat (dynamic inputs, debounced sources)")
    view.resize(900, 520)
    view.show()

    f1 = scene.create_node(FactModel)
    f2 = scene.create_node(FactModel)
    v  = scene.create_node(ConcatViewerModel)

    set_node_pos(scene, f1, -250, -80)
    set_node_pos(scene, f2, -250,  80)
    set_node_pos(scene, v,   150,   0)

    # scene.create_connection(f1[PortType.output][0], v[PortType.input][0])
    # # add a second input, then wire f2 → input[1]
    # v.model._add_input()
    # scene.create_connection(f2[PortType.output][0], v[PortType.input][1])

    # # prefill
    # f1.model.embedded_widget().setText("First fact — press Enter to commit.")
    # f2.model.embedded_widget().setText("Second fact — press Enter to commit.")

    return app.exec_()

if __name__ == "__main__":
    raise SystemExit(main())
