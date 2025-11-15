import { ref, nextTick } from 'vue'
import type { Ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { VueFlowStore } from '@vue-flow/core'

interface DemoOptions {
    demoActive: Ref<boolean>
    nodes: Ref<Node[]>
    setNodes: VueFlowStore['setNodes']
    setEdges: VueFlowStore['setEdges']
    addNodes: VueFlowStore['addNodes']
    screenToFlowCoordinate: VueFlowStore['screenToFlowCoordinate']
    dimensions: VueFlowStore['dimensions']
}

export function useDemo({
                            demoActive,
                            nodes,
                            setNodes,
                            setEdges,
                            addNodes,
                            screenToFlowCoordinate,
                            dimensions
                        }: DemoOptions) {
    const currentStep = ref(0)

    // Hilfsfunktion zum Erzeugen einer Node für einen Step
    function spawnStepNode(x: number, y: number, content: string) {
        if (!dimensions.value) return

        const position = screenToFlowCoordinate({ x, y })
        const node: Node = {
            id: `tourguide-${currentStep.value}`,
            type: 'tourGuide',
            position,
            data: { label: 'Steve', value: content },
            dragHandle: '.doc-node__header'
        }

        setNodes([node]) // immer nur diesen Node anzeigen
    }

    // Steps definieren – exakt so wie von dir
    const steps: (() => void)[] = [
        () => {
            spawnStepNode(
                dimensions.value!.width / 2,
                dimensions.value!.height / 2,
                '👋 Hey! I am Steve the StickyNote.\nYou can place StickyNotes anywhere on the canvas as reminders, notes, or scratch paper. ' +
                'Just drag one of my friends out of the control bar to your left! You can drag all the nodes around by the bar on the top (Where my face is).'
            )
        },
        () => {
            spawnStepNode(
                200,
                100,
                'Over here!' +
                '\nThis is the control bar. The top-part has 6 control-elements:' +
                '\n1. Trashcan: Deletes selected elements' +
                '\n2. Floppydisk: Downloads your project' +
                '\n3. Upload: Uploads a project' +
                '\n4. Magic-Wand: Sorts your graph automatically' +
                '\n5. UNETHICAL MODE: Unlocks LLM-based nodes' +
                '\n6. TLDR MODE: Shrinks some nodes for a better overview'
            )
        },
        () => {
            spawnStepNode(
                200,
                400,
                'Down here, you can drag nodes you would like to use onto the canvas.' +
                '\nYou already know what the StickyNote is for.' +
                '\n\nBy the way, that thing in the bottom right corner is a minimap. It shows an overview and marks selected elements in red.' +
                '\nYou can select multiple elements by clicking them while holding down the CTRL key.' +
                '\n\nNow lets explore all the nodes. Most of them are pretty self-explanatory.'
            )
        },
        () => {
            if (!dimensions.value) return

            const x1 = 300, y1 = 50
            const xCompose = 1000, yCompose = 300
            const xGuide = 600, yGuide = 100
            const xGuide2 = 600, yGuide2 = 3000
            const xDoc = 900, yDoc = 300

            const textNode1: Node = {
                id: 'text-input-1',
                type: 'textArea',
                position: screenToFlowCoordinate({ x: x1, y: y1 }),
                data: { label: 'Text Input'},
                dragHandle: '.doc-node__header'
            }

            const composeNode: Node = {
                id: 'compose-node',
                type: 'compose',
                position: screenToFlowCoordinate({ x: xCompose, y: yCompose }),
                data: { label: 'Compose Node' },
                dragHandle: '.doc-node__header'
            }

            const docNode: Node = {
                id: 'doc-output',
                type: 'docOutput',
                position: screenToFlowCoordinate({ x: xDoc, y: yDoc }),
                data: { label: 'Document Output Node', value: 'Combines inputs' },
                dragHandle: '.doc-node__header'
            }

            const tourGuideNode: Node = {
                id: 'tourguide-step3',
                type: 'tourGuide',
                position: screenToFlowCoordinate({ x: xGuide, y: yGuide }),
                data: {
                    label: 'Steve',
                    value: 'Looks like i am in the way! Well not only me. Why don\'t you drag me to the side and zoom out a little?' +
                        '\nJust use your mousewheel outside a node. You should also resize me to read the rest of the instructions. Or you can scroll.' +
                        '\nThose are the basics. Find Peter using the MiniMap, he\'ll show you the rest!' +
                        '\nDon\'t forget to delete me please. I\'m tired.'
                },
                dragHandle: '.doc-node__header'
            }

            const tourGuideNode2: Node = {
                id: 'tourguide2-step3',
                type: 'tourGuide',
                position: screenToFlowCoordinate({ x: xGuide2, y: yGuide2 }),
                data: {
                    label: 'Peter',
                    value: 'Hey man! I\'m Peter the Post-It.' +
                        '\n Nowthat should be all the node types we currently have.' +
                        '\nWhen you\'re done playing around, delete me and the others or just end the demo.' +
                        '\nAnd then, why don\'t you use that upload button there and load the project we prepared for you?'


                },
                dragHandle: '.doc-node__header'
            }

            setNodes([textNode1, composeNode, docNode, tourGuideNode, tourGuideNode2])
        }
    ]

    // Führt einen Step aus
    function executeStep(stepIndex: number) {
        const step = steps[stepIndex]
        if (!step || !demoActive.value) return
        step()
    }

    function startDemo() {
        demoActive.value = true
        currentStep.value = 0
        executeStep(currentStep.value)
    }

    function skipDemo() {
        demoActive.value = false
        setNodes([])
    }

    function nextStep() {
        if (currentStep.value + 1 < steps.length) {
            currentStep.value++
            executeStep(currentStep.value)
        }
    }

    return { startDemo, skipDemo, nextStep }
}
