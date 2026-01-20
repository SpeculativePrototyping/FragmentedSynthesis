import { ref, watch } from 'vue'
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

    // --------------------------------------------------
    // Helper: Spawn Steve for current step
    // --------------------------------------------------
    function spawnStepNode(
        x: number,
        y: number,
        content: string,
        replaceCanvas = false
    ) {
        if (!dimensions.value) return

        const position = screenToFlowCoordinate({ x, y })

        const steve: Node = {
            id: `tourguide-${currentStep.value}`,
            type: 'tourGuide',
            position,
            data: {
                label: 'Steve',
                value: content
            },
            dragHandle: '.doc-node__header'
        }

        if (replaceCanvas) {
            // Nur für frühe Schritte
            setNodes([steve])
        } else {
            // Ab Step 2: User-Nodes behalten
            setNodes(ns => [
                ...ns.filter(n => n.type !== 'tourGuide'),
                steve
            ])
        }
    }


    // --------------------------------------------------
    // Steps
    // --------------------------------------------------
    const steps: (() => void)[] = [

        // STEP 0 – Welcome (manual)
        () => {
            spawnStepNode(
                dimensions.value!.width / 2,
                dimensions.value!.height / 2,
                `👋 Hey! I'm Steve the StickyNote.

Fragmented Synthesis lets you build documents
from connected fragments instead of linear text.

Click “Next” when you're ready.`, true
            )
        },

        // STEP 1 – Controls (manual)
        () => {
            spawnStepNode(
                200,
                100,
                `This is the control bar.
                             
The top part features a set of buttons and switches for side-panels, the "TLDR" mode and a language selector.

You can add nodes from below
and connect them freely on the canvas.

Click “Next Step” and let's build a document.`, true
            )
        },

        // STEP 2 – Core document nodes (automatic)
        () => {
            spawnStepNode(
                200,
                400,
                `Let’s build the core of a document.

Please create:
• a Paragraph node
• a Raw LaTeX node
• a Figure node
• a Compose node

You don’t need to connect them yet. Put some content in them and also place a reference in the bibliography side-panel. Maybe try the "Magic LaTeX" feature!
I’ll continue once all are present 🙂`
            )
        },

        // STEP 3 – Document Output (automatic)
        () => {
            spawnStepNode(
                500,
                300,
                `Great!

The paragraph node now has options to cite the source you put in, and also to reference your uploaded image.
Connect the nodes to the compose node and then add a Document Output node.`
            )
        },

        // STEP 4 – LLM Nodes (automatic)
        () => {
            spawnStepNode(
                500,
                500,
                `Last step!
                
This node turns your structure
into an actual LaTeX document.
Connect the Compose Node to it and you will see.       

The following nodes help you refine text:
Edit, Paraphrase, and Grammar.

Try adding at least one of them by clicking the connection between your Paragraph Node and the Compose Node.`
            )
        },

        // STEP 5 – Finish
        () => {
            spawnStepNode(
                dimensions.value!.width / 2,
                dimensions.value!.height / 2,
                `🎉 You're done!

You’ve seen the core workflow:
Fragments → Structure → Document.

Click “End Demo” to clear the canvas
and start working on your own project.`
            )

            //demoActive.value = false
        }
    ]

    // --------------------------------------------------
    // Step control
    // --------------------------------------------------
    function executeStep(stepIndex: number) {
        const step = steps[stepIndex]
        if (!step || !demoActive.value) return
        step()
    }

    function startDemo() {
        demoActive.value = true
        currentStep.value = 0
        executeStep(0)
    }

    function nextStep() {
        if (currentStep.value + 1 < steps.length) {
            currentStep.value++
            executeStep(currentStep.value)
        }
    }

    function skipDemo() {
        demoActive.value = false
        setNodes([])
    }

    // --------------------------------------------------
    // Watcher: automatic progression
    // --------------------------------------------------
    watch(
        () => nodes.value.map(n => n.type),
        () => {
            if (!demoActive.value) return

            // STEP 2 → STEP 3
            if (currentStep.value === 2) {
                const required = ['textArea', 'magicLatex', 'figure', 'compose']
                const hasAll = required.every(t => nodes.value.some(n => n.type === t))
                if (hasAll) {
                    currentStep.value++
                    executeStep(currentStep.value)
                }
            }

            // STEP 3 → STEP 4
            if (currentStep.value === 3) {
                if (nodes.value.some(n => n.type === 'docOutput')) {
                    currentStep.value++
                    executeStep(currentStep.value)
                }
            }

            // STEP 4 → STEP 5
            if (currentStep.value === 4) {
                const llmTypes = ['edit', 'paraphrase', 'grammar']
                if (llmTypes.some(t => nodes.value.some(n => n.type === t))) {
                    currentStep.value++
                    executeStep(currentStep.value)
                }
            }
        },
        { deep: true }
    )

    return {
        startDemo,
        nextStep,
        skipDemo
    }
}
