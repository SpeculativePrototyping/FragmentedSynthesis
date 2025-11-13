import { ref, watch, nextTick } from 'vue'
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

    // Steps definieren
    const steps: (() => void)[] = [
        () => {
            // Step 0: Node in der Mitte
            spawnStepNode(
                dimensions.value!.width / 2,
                dimensions.value!.height / 2,
                '👋 Hey! I am Steve the StickyNote.\nYou can place StickyNotes anywhere on the canvas as reminders, notes, or scratchpaper. Just drag one of my friends out of the control bar to your left!'
            )
        },
        () => {
            // Step 1: Node links bei Controlbar
            spawnStepNode(
                200,
                100,
                'Over here!' +
                '\nThis is the controlbar. The top-part has 6 control-elements:' +
                '\n1. Trashcan: Deletes selected elements' +
                '\n2. Floppydisk: Downloads your project' +
                '\n3. Upload: Uploads a project' +
                '\n4. Magic-Wand: Sorts your graph automatically' +
                '\n5. UNETHICAL MODE: Unlocks LLM-based nodes' +
                '\n6. TLDR MODE: Shrinks nodes for a better overview'
            )
        },
        () => {
            // Step 2: Weitere Erklärung
            spawnStepNode(
                200,
                300,
                'Down here, you can drag nodes you would like to use onto the canvas.' +
                '\nYou already know what the StickyNote is for.' +
                '\n\nBy the way, that thing in the bottom right corner is a minimap. It shows an overview and marks selected elements in red.' +
                '\nYou can select multiple elements by clicking them while holding down the CTRL key.' +
                '\n\nNow lets explore all the other nodes.'
            )
        },
        () => {
            //Step3: Interaktives Beispiel
            if (!dimensions.value) return

            // Koordinaten der Nodes
            const x1 = 300
            const y1 = 50
            const x2 = 300
            const y2 = 600
            const xCompose = 1000
            const yCompose = 300
            const xGuide = 600
            const yGuide = 100
            const xGuide2 = 600
            const yGuide2 = 3000
            const xDoc = 900
            const yDoc = 300

            // Erstelle die Nodes
            const textNode1: Node = {
                id: 'text-input-1',
                type: 'textArea', // Typ anpassen an deine Node-Definition
                position: screenToFlowCoordinate({ x: x1, y: y1 }),
                data: { label: 'Text Input', value: 'This is a paragraph.' },
                dragHandle: '.doc-node__header'
            }

            const textNode2: Node = {
                id: 'text-input-2',
                type: 'textArea',
                position: screenToFlowCoordinate({ x: x2, y: y2 }),
                data: { label: 'Text Input', value: 'This is also a paragraph. Duh.' },
                dragHandle: '.doc-node__header'
            }

            const composeNode: Node = {
                id: 'compose-node',
                type: 'compose',
                position: screenToFlowCoordinate({ x: xCompose, y: yCompose }),
                data: { label: 'Compose', value: 'Combines inputs' },
                dragHandle: '.doc-node__header'
            }

            const docNode: Node = {
                id: 'doc-output',
                type: 'docOutput',
                position: screenToFlowCoordinate({ x: xDoc, y: yDoc }),
                data: { label: 'Document Output', value: 'Combines inputs' },
                dragHandle: '.doc-node__header'
            }

            const tourGuideNode: Node = {
                id: 'tourguide-step3',
                type: 'tourGuide',
                position: screenToFlowCoordinate({ x: xGuide, y: yGuide }),
                data: {
                    label: 'Steve',
                    value: 'Looks like i am in the way! Well not only me. Why don\'t you drag me to the side and zoom out a little?' +
                            '\nJust use your mousewheel. You should also resize me to read the rest of the instructions. Or you can scroll.' +
                            '\nWhen you\'re done with that, sort out the mess, and make connections from the Text Input Nodes to the Compose Node.' +
                            '\nWhile you\'re at it: Connect the Compose Node to the Document Output Node.' +
                            '\nOh, and give your section a title.' +
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
                    value: 'Hey man! What you also need to know:' +
                            '\nThe Text View Node can display what the other nodes spit out. Drag one over here if you want to try it.' +
                            '\nThe Reference Tracker keeps track of your Bibliography. It\'s also wireless. Magic.' +
                            '\nI mean, it does not show the flow of your content so all the connections to and from it would be in the way, so..' +
                            '\nAfter you\'ve put in a reference, you can add citations anywhere in your paragraphs. You\'ll figure that out on your own.' +
                            '\nHere\'s a reference if you want to try it out:' +
                            '\n\n@article{asnicar2024machine,\n' +
                        '  title={Machine learning for microbiologists},\n' +
                        '  author={Asnicar, Francesco and Thomas, Andrew Maltez and Passerini, Andrea and Waldron, Levi and Segata, Nicola},\n' +
                        '  journal={Nature Reviews Microbiology},\n' +
                        '  volume={22},\n' +
                        '  number={4},\n' +
                        '  pages={191--205},\n' +
                        '  year={2024},\n' +
                        '  publisher={Nature Publishing Group UK London}\n' +
                        '}' +
                            '\n\nThe other node-types are.. cough. Not ready for primetime yet.' +
                            '\nWhen you\'re done playing around, delete me and the others to end the tutorial.'


                },
                dragHandle: '.doc-node__header'
            }

            // Setze alle Nodes gleichzeitig
            setNodes([textNode1, textNode2, composeNode, docNode,  tourGuideNode, tourGuideNode2])
        }

    ]

    // Startet einen Step und plant automatisch den nächsten nach 5 Sekunden
    function startStep(stepIndex: number) {
        const step = steps[stepIndex]
        if (!step || !demoActive.value) return

        step() // Node anzeigen

        // Nächsten Step planen
        if (stepIndex + 1 < steps.length) {
            setTimeout(() => {
                if (!demoActive.value) return
                currentStep.value = stepIndex + 1
                startStep(currentStep.value)
            }, 8000)
        } else {
            // Letzter Step – nach 5 Sekunden Demo beenden
            setTimeout(() => {
                demoActive.value = false
            }, 8000)
        }
    }

    watch(demoActive, (active) => {
        if (active) {
            nextTick(() => {
                startStep(currentStep.value)
            })
        }
    })

    function startDemo() {
        demoActive.value = true
        currentStep.value = 0
        startStep(currentStep.value)
    }

    function skipDemo() {
        demoActive.value = false
    }

    return { startDemo, skipDemo }
}
