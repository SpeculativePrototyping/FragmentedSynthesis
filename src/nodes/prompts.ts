//Grammar Node Prompts:

export interface GrammarPrompts {
    basePrompt: string
    responseFormat: object
}

export const grammarPrompts: Record<'en' | 'de', GrammarPrompts> = {
    en: {
        basePrompt:
            'You are a concise academic writing assistant. ' +
            'Task: Correct grammar and spelling in a single sentence. ' +
            'Do NOT change word order, add new content, or remove existing content. ' +
            'Fix only grammatical and spelling mistakes. ' +
            'Now process the following input and respond strictly with JSON containing one string property grammar.',
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'grammar_response',
                schema: {
                    type: 'object',
                    properties: { grammar: { type: 'string' } },
                    required: ['grammar'],
                    additionalProperties: false
                }
            }
        }
    },
    de: {
        basePrompt:
            'Du bist ein prägnanter akademischer Schreibassistent. ' +
            'Aufgabe: Korrigiere Grammatik und Rechtschreibung in einem einzigen Satz. ' +
            'Ändere NICHT die Wortreihenfolge, füge keinen neuen Inhalt hinzu und entferne keinen bestehenden Inhalt. ' +
            'Korrigiere nur Grammatik- und Rechtschreibfehler. ' +
            'Verarbeite nun die folgende Eingabe und antworte strikt mit JSON, das eine String-Eigenschaft grammar enthält.',
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'grammar_response',
                schema: {
                    type: 'object',
                    properties: { grammar: { type: 'string' } },
                    required: ['grammar'],
                    additionalProperties: false
                }
            }
        }
    }
}

//Text-Node Prompts:

export interface TextNodePrompts {
    basePrompt: string
    responseFormat: object
}

export const textNodePrompts: Record<'en' | 'de', TextNodePrompts> = {
    en: {
        basePrompt:
            'You are a concise academic assistant. ' +
            'Task: Summarize the user\'s input text in one extremely short sentence. ' +
            'Generate the summary exclusively in the english language.' +
            'Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph. ' +
            'Respond strictly with JSON containing one string property named "summary".',
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'summary_response',
                schema: {
                    type: 'object',
                    properties: { summary: { type: 'string' } },
                    required: ['summary'],
                    additionalProperties: false
                }
            }
        }
    },
    de: {
        basePrompt:
            'Du bist ein prägnanter akademischer Assistent. ' +
            'Aufgabe: Fasse den Text des Benutzers in einem extrem kurzen Satz zusammen. ' +
            'Generiere die Zusammenfassung ausschließlich in deutscher Sprache.' +
            'Gib nur LaTeX-sicheren Text aus (keine Umgebungen), geeignet für die Einbindung in einen Absatz. ' +
            'Antworte strikt mit JSON, das eine String-Eigenschaft "summary" enthält.',
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'summary_response',
                schema: {
                    type: 'object',
                    properties: { summary: { type: 'string' } },
                    required: ['summary'],
                    additionalProperties: false
                }
            }
        }
    }
}


// SUMMARY NODE PROMPTS

export interface SummaryPrompts {
    basePrompt: string
    userPromptIntro: string
    templateToneIntro: string
    templateSentenceCount: string
    templateExamplesIntro: string
    responseFormat: object
}

export const summaryPrompts: Record<'en' | 'de', SummaryPrompts> = {
    en: {
        basePrompt:
            "You are a concise academic assistant. Output only LaTeX-safe prose, suitable for inclusion in a paragraph. Respond strictly with JSON containing a single string property named 'paraphrase'.",

        userPromptIntro: "Paraphrase the following text:",
        templateToneIntro: "Use the following style template precisely:",
        templateSentenceCount: "Paraphrase in exactly {{n}} sentences.",
        templateExamplesIntro: "Examples:",

        responseFormat: {
            type: "json_schema",
            json_schema: {
                name: "paraphrase_response",
                schema: {
                    type: "object",
                    properties: { paraphrase: { type: "string" } },
                    required: ["paraphrase"],
                    additionalProperties: false
                }
            }
        }
    },

    de: {
        basePrompt:
            "Du bist ein prägnanter akademischer Assistent. Gib nur LaTeX-sicheren Text aus, geeignet für einen Absatz. Antworte strikt mit JSON, das eine String-Eigenschaft 'paraphrase' enthält.",

        userPromptIntro: "Paraphrasiere den folgenden Text:",
        templateToneIntro: "Nutze das folgende Stil-Template exakt:",
        templateSentenceCount: "Paraphrasiere in genau {{n}} Sätzen.",
        templateExamplesIntro: "Beispiele:",

        responseFormat: {
            type: "json_schema",
            json_schema: {
                name: "paraphrase_response",
                schema: {
                    type: "object",
                    properties: { paraphrase: { type: "string" } },
                    required: ["paraphrase"],
                    additionalProperties: false
                }
            }
        }
    }
}



// Edit Node Prompts

export interface ReviewPrompts {
    systemPrompt: string         // System-Prompt für die LLM-Aktion
    responseFormat: object       // JSON-Schema
}

export const reviewPrompts: Record<'en' | 'de', ReviewPrompts> = {
    en: {
        systemPrompt:
            "You are an academic writing assistant. " +
            "Task: Revise the provided text according to the reviewer's comment. " +
            "Improve clarity, style, grammar, and explanations where the reviewer requested more detail. " +
            "Preserve citations, references, and overall structure. " +
            "Respond strictly with JSON containing a single string property named 'value'." +
            "Ensure that the text in \"value\" is complete sentences and never cuts off mid-sentence.",
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'review_response',
                schema: {
                    type: 'object',
                    properties: {
                        value: { type: 'string' }  // der angepasste Text
                    },
                    required: ['value'],
                    additionalProperties: false
                }
            }
        }
    },
    de: {
        systemPrompt:
            "Du bist ein akademischer Schreibassistent. " +
            "Aufgabe: Passe den angegebenen Text basierend auf dem Kommentar des Reviewers an. " +
            "Füge keine neuen Inhalte hinzu, die nicht mit dem Kommentar zusammenhängen. " +
            "Behalte Zitate, Referenzen und die Struktur bei. " +
            "Ändere nur Sätze, um die Vorschläge des Reviewers umzusetzen." +
            "Antworte strikt mit JSON, das eine String-Eigenschaft 'value' enthält." +
            "Stelle sicher dass der text in \"value\" komplette Sätze enthält und nie mitten im Satz abgeschnitten wird.",
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'review_response',
                schema: {
                    type: 'object',
                    properties: {
                        value: { type: 'string' }  // der angepasste Text
                    },
                    required: ['value'],
                    additionalProperties: false
                }
            }
        }
    }
}

export interface MagicLatexPrompts {
    systemPrompt: string
    userPromptAdd: string
    userPromptModify: string
    responseFormat: object
}


export const magicLatexPrompts: Record<'en' | 'de', MagicLatexPrompts> = {
    en: {
        systemPrompt:
            "You are a LaTeX expert for academic documents. " +
            "You generate or modify valid LaTeX code. " +
            "You NEVER explain anything. " +
            "You NEVER include markdown. " +
            "You NEVER wrap the output in \\begin{document}. " +
            "You output ONLY raw LaTeX code. " +
            "The result must be syntactically correct and ready to paste into a LaTeX document.",

        userPromptAdd:
            "Generate a LaTeX structure based on the following request. " +
            "The output should be a complete LaTeX environment or structure that the user can fill in:\n\n" +
            "{{request}}",

        userPromptModify:
            "Modify the following LaTeX code according to the instruction below. " +
            "Preserve as much of the original structure as possible.\n\n" +
            "LaTeX code:\n{{latex}}\n\n" +
            "Instruction:\n{{request}}",

        responseFormat: {
            type: "json_schema",
            json_schema: {
                name: "magic_latex_response",
                schema: {
                    type: "object",
                    properties: {
                        latex: { type: "string" }
                    },
                    required: ["latex"],
                    additionalProperties: false
                }
            }
        }
    },

    de: {
        systemPrompt:
            "Du bist ein LaTeX-Experte für akademische Dokumente. " +
            "Du erzeugst oder modifizierst gültigen LaTeX-Code. " +
            "Du erklärst NIEMALS etwas. " +
            "Du verwendest KEIN Markdown. " +
            "Du fügst KEIN \\begin{document} hinzu. " +
            "Du gibst AUSSCHLIESSLICH reinen LaTeX-Code aus. " +
            "Das Ergebnis muss syntaktisch korrekt und direkt verwendbar sein.",

        userPromptAdd:
            "Erzeuge eine LaTeX-Struktur basierend auf der folgenden Anforderung. " +
            "Die Ausgabe soll eine vollständige LaTeX-Umgebung oder Struktur sein, die der Benutzer ausfüllen kann:\n\n" +
            "{{request}}",

        userPromptModify:
            "Modifiziere den folgenden LaTeX-Code gemäß der untenstehenden Anweisung. " +
            "Erhalte die bestehende Struktur so weit wie möglich.\n\n" +
            "LaTeX-Code:\n{{latex}}\n\n" +
            "Anweisung:\n{{request}}",

        responseFormat: {
            type: "json_schema",
            json_schema: {
                name: "magic_latex_response",
                schema: {
                    type: "object",
                    properties: {
                        latex: { type: "string" }
                    },
                    required: ["latex"],
                    additionalProperties: false
                }
            }
        }
    }
}




