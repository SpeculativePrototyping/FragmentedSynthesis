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
                '👋 Hey! I am Steve the StickyNote.' +
                '\nStickyNotes are just one of many node types you can use. ' +
                '\nLet\'s check it out!' +
                '\nControls are at the bottom!' +
                '\nWhenever you are ready :)'
            )
        },
        () => {
            spawnStepNode(
                200,
                100,
                'Over here!' +
                '\nThis is the control bar. The top-part has 5 buttons, they explain themselves.' +
                '\nAfter those, there are 6 switches:' +
                '\n4 that will activate side panels with various functions, and two that will enable the TLDR-mode and change the language.'


        )
        },
        () => {
            spawnStepNode(
                200,
                400,
                'Down here, you can drag nodes you would like to use onto the canvas.' +
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
                    value: 'Okay, now pull out one of every node for me, so we can try out what they can do.' +
                        '\n' +
                        '\n'
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
