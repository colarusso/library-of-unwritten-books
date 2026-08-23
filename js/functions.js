//var msg = `The library's creator is hosting a <a href="https://suffolklitlab.org/LITCon/2024/" target="_blank">hybrid event at Suffolk Law School</a> on April 8th on AI and law practice. Join us!`
msg = "";

function close_msg() {
    document.getElementById('msg_bar').style.display='none';
    localStorage.setItem('msg',msg)
}

document.addEventListener('DOMContentLoaded', function () {

    if (localStorage.msg != msg && msg != "") {
        document.getElementById('msg_bar').innerHTML = `<a href="javascript:close_msg();" class="ex">X</a>`+ msg;
        document.getElementById('msg_bar').style.display='block';    
    }

    const toggleModeButton = document.getElementById("toggle-mode");
  
    // Retrieve dark mode state from localStorage (if available)
    const darkModeState = localStorage.getItem("darkMode");
    if (darkModeState === "enabled") {
      document.body.classList.add("dark-mode");
        toggleModeButton.innerHTML = "💡"; // Light bulb emoji
    }
  
    // Toggle between light and dark mode
    toggleModeButton.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
        if (document.body.classList.contains("dark-mode")) {
            localStorage.setItem("darkMode", "enabled");
            toggleModeButton.innerHTML = "💡"; // Light bulb emoji
        } else {
            localStorage.removeItem("darkMode");
            toggleModeButton.innerHTML = "🌗"; // Moon emoji
        }
    });

});

// Replace template markers without allowing replacement strings such as "$&" or "$1"
// to be interpreted by String.replace(). This is important when inserting user or LLM text.
function replaceAllLiteral(source, search, replacement) {
    const input = source == null ? '' : String(source);
    const value = replacement == null ? '' : String(replacement);

    if (search instanceof RegExp) {
        return input.replace(search, () => value);
    }

    return input.split(String(search)).join(value);
}


// Clean up common double-escaped story-text artifacts without interpreting arbitrary
// backslash sequences. This runs after JSON parsing (or on plain-text LLM output),
// never on a raw JSON document where changing escapes could invalidate the payload.
function normalizeLLMTextArtifacts(text) {
    let value = text == null ? '' : String(text);

    // Some models emit "\\/n" when they mean a line break, or double-escape a
    // normal JSON newline/quote. Handle only the story-text sequences we know.
    const replacements = [
        ['\\/r\\/n', '\n'],
        ['\\/n', '\n'],
        ['\\/r', '\n'],
        ['\\r\\n', '\n'],
        ['\\n', '\n'],
        ['\\r', '\n'],
        ['\\"', '"']
    ];

    for (const [encoded, decoded] of replacements) {
        value = value.split(encoded).join(decoded);
    }

    // Structured-output models sometimes satisfy a string schema by ending the
    // value with a run of literal backslashes (for example: "prose. \\").
    // A single terminal backslash can be intentional, so only remove runs of two
    // or more. This is deliberately done after JSON parsing, never on raw JSON.
    value = value.replace(/\\{2,}\s*$/, '');

    return value;
}

function normalizeLLMJSONStrings(value) {
    if (typeof value === 'string') {
        return normalizeLLMTextArtifacts(value);
    }
    if (Array.isArray(value)) {
        return value.map(normalizeLLMJSONStrings);
    }
    if (value && typeof value === 'object') {
        const normalized = {};
        for (const [key, item] of Object.entries(value)) {
            normalized[key] = normalizeLLMJSONStrings(item);
        }
        return normalized;
    }
    return value;
}

// Chained templates depend on named fields from a prior JSON response. Treat a
// missing field as an explicit chain failure instead of silently replacing it
// with an empty string (String(undefined) was previously normalized to "").
function getRequiredTemplateValue(container, key, sourceName = 'passThrough') {
    const isObject = container && typeof container === 'object' && !Array.isArray(container);
    if (!isObject || !Object.prototype.hasOwnProperty.call(container, key) || container[key] == null) {
        throw new Error(`The previous LLM step did not provide required field ${sourceName}["${key}"].`);
    }
    return container[key];
}

function isLMStudioEndpoint(...urls) {
    return urls.some(url => String(url == null ? '' : url).toLowerCase().includes('#lmstudio'));
}

// #lmstudio is an application-only marker. URL fragments are not part of an
// HTTP request, but strip it explicitly so detection and transport cannot drift
// apart when credentials are changed while the page is open.
function stripLMStudioEndpointTag(url) {
    const value = String(url == null ? '' : url);
    const markerIndex = value.toLowerCase().indexOf('#lmstudio');
    return markerIndex === -1 ? value : value.slice(0, markerIndex);
}

// A #lmstudio endpoint is an endpoint-level contract: every LLM request must
// carry a JSON schema. JSON-oriented prompts use their native object schema;
// ordinary prose calls use a one-field envelope that is unwrapped before the
// rest of the application sees the response.
function buildLMStudioResponseFormat(promptText, expectsJSON = true) {
    const prompt = promptText == null ? '' : String(promptText);
    let properties;
    let required;

    const hasAll = (...needles) => needles.every(needle => prompt.includes(needle));

    if (expectsJSON && (
        hasAll('"difficulty"', '"difficulty_cutoff"', '"roll"', '"success"', '"narrative"') ||
        prompt.endsWith(`Don't hide information in the protagonist's mind. The reader should know everything they do and in detail. \n`)
    )) {
        properties = {
            difficulty: { type: 'string' },
            difficulty_cutoff: { type: 'integer' },
            roll: { type: 'integer' },
            success: { type: 'integer' },
            narrative: { type: 'string' }
        };
        required = ['difficulty', 'difficulty_cutoff', 'roll', 'success', 'narrative'];
    } else if (expectsJSON && (
        hasAll('"title"', '"opening"') ||
        prompt.endsWith(`"title" and it contains an evocative and appropriate title for the type of story you want to tell. \n\n`)
    )) {
        properties = {
            opening: { type: 'string' },
            title: { type: 'string' }
        };
        required = ['title', 'opening'];
    } else if (expectsJSON && (
        prompt.includes('"next_beat"') ||
        prompt.startsWith(`You're helping write a short story. `) ||
        prompt.startsWith(`In a moment, I'm going to show you some background materials used to run a role playing game, followed by the text of how things played out.`)
    )) {
        properties = {
            next_beat: { type: 'string' }
        };
        required = ['next_beat'];
    } else if (expectsJSON && (
        prompt.includes('"genre"') ||
        prompt.startsWith(`Produce a JSON object where the key is "genre"`)
    )) {
        properties = {
            genre: { type: 'string' }
        };
        required = ['genre'];
    } else if (!expectsJSON) {
        return {
            type: 'json_schema',
            json_schema: {
                name: 'llm_text_response',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        response: { type: 'string' }
                    },
                    required: ['response'],
                    additionalProperties: false
                }
            }
        };
    } else {
        // Custom JSON templates still need a schema on LM Studio. This generic
        // object schema preserves their prompt-defined keys without silently
        // dropping response_format. The built-in story templates above keep
        // their more specific schemas.
        return {
            type: 'json_schema',
            json_schema: {
                name: 'llm_json_response',
                schema: {
                    type: 'object',
                    additionalProperties: true
                }
            }
        };
    }

    return {
        type: 'json_schema',
        json_schema: {
            name: 'llm_response',
            strict: true,
            schema: {
                type: 'object',
                properties,
                required,
                additionalProperties: false
            }
        }
    };
}

function unwrapLMStudioTextResponse(content) {
    try {
        const parsed = parseJSONResponse(content);
        if (parsed && typeof parsed === 'object' && typeof parsed.response === 'string') {
            return parsed.response;
        }
    } catch (error) {
        console.warn('LM Studio prose response was not wrapped as expected; using raw content.', error);
    }
    return content;
}

// JSON-mode providers occasionally wrap otherwise valid JSON in Markdown fences or prose.
// Accept those harmless wrappers while still requiring the payload itself to be valid JSON.
function parseJSONResponse(text) {
    const raw = text == null ? '' : String(text);
    const trimmed = raw.replace(/^\uFEFF/, '').trim();
    const candidates = [trimmed];

    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) {
        candidates.push(fenced[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }

    let lastError = null;
    for (const candidate of [...new Set(candidates)]) {
        if (!candidate) continue;
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            lastError = new Error('Expected a JSON object.');
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No JSON object found in response.');
}

const JSON_OUTPUT_GUARDRAIL = `\n\nIMPORTANT OUTPUT FORMAT: Return exactly one valid JSON object and nothing else. Do not wrap it in Markdown or code fences. Every string value must use valid JSON escaping: escape embedded double quotes as \\", backslashes as \\\\, and line breaks as \\n. Ensure the complete response can be parsed by JSON.parse without repair.`;

function addJSONOutputGuardrail(promptText) {
    const prompt = promptText == null ? '' : String(promptText);
    if (prompt.includes('IMPORTANT OUTPUT FORMAT: Return exactly one valid JSON object')) {
        return prompt;
    }
    return prompt + JSON_OUTPUT_GUARDRAIL;
}
