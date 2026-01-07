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
                'Just drag one of my friends out of the control bar to your left! You can drag all the nodes around by the bar on the top (Where my face is).' +
                'You can also scroll if you put your mouse over the text, in case the text is longer than me.' +
                'Controls are at the bottom! Whenever you are ready :)'
            )
        },
        () => {
            spawnStepNode(
                200,
                100,
                'Over here!' +
                '\nThis is the control bar. The top-part has 5 control-elements:' +
                '\n1. Snapshot: Take a snapshot of your current workspace so you can come back later if you want to go back to an earlier state.' +
                '\n2. Delete: Delete multiple elements at the same time. Select multiple elements by holding CTRL.' +
                '\n3. Download: Download your current project to your computer. This includes all your Snapshots as well, just to be sure.' +
                '\n4. Upload: Upload a project from your computer.' +
                '\n5. Unchaosify: Will automatically sort all your elements from left to right according to the flow of content. Use again after enabling TLDR-Mode!' +

                '\nAfter those, there are 6 switches:' +

                '\n1. Bibliography: In this panel, you can manage your references.' +
                '\n2. Figures: A list of all your figures and their reference keys. You can open this panel if you want to reference a figure in your text.' +
                '\n3. Style: In here, you can set style templates to use for LLM functionality in the Paraphrase Node.' +
                '\n4. Snapshots: If you have taken a snapshot of your work, you can come back here and restore one of your saved states. A snapshot will be created once a minute automatically, in case you delete something important. ' +
                '\n5. TLDR MODE: Collapses Text Input Nodes and Figure Nodes to a minimal size, so you can focus on high-level organization.' +
                '\n6. Language: Select the language you work in. This does not change the UI language, but will exchange LLM prompts in the background to ensure proper implementation.'

        )
        },
        () => {
            spawnStepNode(
                200,
                400,
                'Down here, you can drag nodes you would like to use onto the canvas.' +
                '\nYou already know what the StickyNote is for.' +
                '\n\nBy the way, that thing in the bottom right corner is a minimap. It shows an overview and marks currently selected elements in red.' +
                '\nYou can select multiple elements by clicking them while holding down the CTRL key.' +
                '\n\nNow lets explore all the nodes. Drag one of each over here and take a look!'
            )
        },
        () => {
            if (!dimensions.value) return



            const tourGuideNode: Node = {
                id: 'tourguide-step3',
                type: 'tourGuide',
                position: screenToFlowCoordinate({ x: 700, y: 200 }),
                data: {
                    label: 'Steve',
                    value: 'Looks like i am in the way!  Why don\'t you drag me to the side and zoom out a little?' +
                        '\nJust use your mousewheel outside a node. You should also resize me to read the rest of the instructions. Or you can scroll.' +
                        '\nAll of the nodes you see are pretty self-explanatory and tell you what they do. ' +
                        '\nThose are the basics. Find Peter using the MiniMap, he\'ll show you the rest!' +
                        '\nDon\'t forget to delete me please. I\'m tired.'
                },
                dragHandle: '.doc-node__header'
            }

            const tourGuideNode2: Node = {
                id: 'tourguide2-step3',
                type: 'tourGuide',
                position: screenToFlowCoordinate({ x: 600, y: 2500 }),
                data: {
                    label: 'Peter',
                    value: 'Hey man! I\'m Peter the Post-It.' +
                        '\nNow that should be all the node types we currently have.' +
                        ' When you are done, just end the demo and start from a blank page, or refresh your browser and import a LaTeX project!'


                },
                dragHandle: '.doc-node__header'
            }

            setNodes([tourGuideNode, tourGuideNode2])
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
