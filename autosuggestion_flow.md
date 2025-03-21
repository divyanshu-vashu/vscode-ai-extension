Below is a refined version of your auto‐suggestion workflow diagram and pseudocode algorithm. I've also explained the optimization decision between constant polling (search every second) and using a keyboard event listener with debouncing. This should help clarify both the overall flow and the best practice to reduce unnecessary API calls.

---

### Refined Flowchart Diagram

```
┌────────────────────┐
│    User Types      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Capture Input Event│◄─── (Keyboard Event Listener)
│ (Text, Cursor Info)│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Debounce Input    │   <-- Wait for a brief pause in typing
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Extract Context    │
│ (file content,     │
│  surrounding code, │
│  cursor position)  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Preprocess Data    │
│ (clean/format)     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Generate Prompt    │
│ for Suggestion API │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Send Prompt to     │
│ Suggestion Engine  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Receive Suggestions│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Post-process &     │
│ Rank Suggestions   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Display in Editor  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ User Accepts/Edits │
│ Suggestion         │
└────────────────────┘
```

---

### Pseudocode Algorithm

```javascript
// 1. Attach a keyboard event listener to the input field.
inputField.addEventListener('input', debounce(handleInput, 300));

// 2. Function to handle input event.
function handleInput(event) {
    // Extract text and cursor position from the editor.
    const inputText = event.target.value;
    const cursorPos = getCursorPosition();

    // 3. Extract context based on current file content and cursor position.
    const context = extractContext(inputText, cursorPos);

    // 4. Preprocess the context (clean, format, etc.).
    const cleanData = preprocessContext(context);

    // 5. Generate a prompt for the suggestion engine.
    const prompt = generatePrompt(cleanData);

    // 6. Send the prompt to the suggestion API asynchronously.
    sendPromptToAPI(prompt).then(suggestions => {
        // 7. Post-process the suggestions (filter, rank, etc.).
        const bestSuggestion = rankSuggestions(suggestions);

        // 8. Display the best suggestion in the editor UI.
        updateEditorUI(bestSuggestion);
    }).catch(handleError);
}
```

*Note: The `debounce` function ensures that the `handleInput` is called only after the user pauses typing (e.g., 300ms delay), which is more efficient than polling every second.*

---

### Optimization Discussion

- **Event Listener vs. Polling Every Second:**
  - **Keyboard Event Listener:**  
    - **Pros:**  
      - Responds immediately when the user types.
      - Prevents unnecessary API calls.
      - Works well with debouncing to handle rapid inputs.
    - **Cons:**  
      - Requires proper handling (e.g., debouncing) to avoid overwhelming the system.
  - **Constant Polling (every second):**  
    - **Pros:**  
      - Simple to implement in some cases.
    - **Cons:**  
      - May trigger many redundant searches even when the user isn’t typing.
      - Higher resource usage and potential lag.

**Conclusion:**  
Using a keyboard event listener (with debouncing) is the more optimal approach. It triggers the suggestion workflow only when needed rather than continuously polling at fixed intervals.

---

### Codebase Modularization Tips

To keep your code maintainable:
1. **Event Listener Module:** Handles input events.
2. **Context Manager Module:** Extracts and preprocesses context.
3. **Prompt Generator Module:** Formats context into an API prompt.
4. **API Integration Module:** Manages API calls.
5. **Suggestion Processor Module:** Post-processes and ranks suggestions.
6. **UI Handler Module:** Renders suggestions in the editor.
7. **Main Application Module:** Orchestrates the workflow across modules.

write code for two file and if need anything to update poc-flow then change it 
how to use Ollama api ?
"tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 1.5B",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b-base"
  },


I made two file 
1.src/core/tabautosuggestion_model.ts -> which will connect Ollama api 
2.src/services/autosuggestion.ts -> will use api and process the request 

Below is a refined version of your auto‐suggestion workflow diagram and pseudocode algorithm. I've also explained the optimization decision between constant polling (search every second) and using a keyboard event listener with debouncing. This should help clarify both the overall flow and the best practice to reduce unnecessary API calls.

---
poc-flow
### Refined Flowchart Diagram

```
┌────────────────────┐
│    User Types      │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Capture Input Event│◄─── (Keyboard Event Listener)
│ (Text, Cursor Info)│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  Debounce Input    │   <-- Wait for a brief pause in typing
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Extract Context    │
│ (file content,     │
│  surrounding code, │
│  cursor position)  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Preprocess Data    │
│ (clean/format)     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Generate Prompt    │
│ for Suggestion API │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Send Prompt to     │
│ Suggestion Engine  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Receive Suggestions│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Post-process &     │
│ Rank Suggestions   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Display in Editor  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ User Accepts/Edits │
│ Suggestion         │
└────────────────────┘
```

---

### Pseudocode Algorithm

```javascript
// 1. Attach a keyboard event listener to the input field.
inputField.addEventListener('input', debounce(handleInput, 300));

// 2. Function to handle input event.
function handleInput(event) {
    // Extract text and cursor position from the editor.
    const inputText = event.target.value;
    const cursorPos = getCursorPosition();

    // 3. Extract context based on current file content and cursor position.
    const context = extractContext(inputText, cursorPos);

    // 4. Preprocess the context (clean, format, etc.).
    const cleanData = preprocessContext(context);

    // 5. Generate a prompt for the suggestion engine.
    const prompt = generatePrompt(cleanData);

    // 6. Send the prompt to the suggestion API asynchronously.
    sendPromptToAPI(prompt).then(suggestions => {
        // 7. Post-process the suggestions (filter, rank, etc.).
        const bestSuggestion = rankSuggestions(suggestions);

        // 8. Display the best suggestion in the editor UI.
        updateEditorUI(bestSuggestion);
    }).catch(handleError);
}
```

*Note: The `debounce` function ensures that the `handleInput` is called only after the user pauses typing (e.g., 300ms delay), which is more efficient than polling every second.*

---

### Optimization Discussion

- **Event Listener vs. Polling Every Second:**
  - **Keyboard Event Listener:**  
    - **Pros:**  
      - Responds immediately when the user types.
      - Prevents unnecessary API calls.
      - Works well with debouncing to handle rapid inputs.
    - **Cons:**  
      - Requires proper handling (e.g., debouncing) to avoid overwhelming the system.
  - **Constant Polling (every second):**  
    - **Pros:**  
      - Simple to implement in some cases.
    - **Cons:**  
      - May trigger many redundant searches even when the user isn’t typing.
      - Higher resource usage and potential lag.

**Conclusion:**  
Using a keyboard event listener (with debouncing) is the more optimal approach. It triggers the suggestion workflow only when needed rather than continuously polling at fixed intervals.

---

### Codebase Modularization Tips

To keep your code maintainable:
1. **Event Listener Module:** Handles input events.
2. **Context Manager Module:** Extracts and preprocesses context.
3. **Prompt Generator Module:** Formats context into an API prompt.
4. **API Integration Module:** Manages API calls.
5. **Suggestion Processor Module:** Post-processes and ranks suggestions.
6. **UI Handler Module:** Renders suggestions in the editor.
7. **Main Application Module:** Orchestrates the workflow across modules.


and I am attaching sample code of tab suggestion by continue vs code extension 
83 results - 44 files

core/core.ts:
  814            ...config,
  815:           tabAutocompleteModel: msg.data.model,
  816          };

core/index.d.ts:
  1159    embeddingsProvider?: EmbeddingsProviderDescription;
  1160:   tabAutocompleteModel?: ModelDescription | ModelDescription[];
  1161    tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;

  1205    /** The model that Continue will use for tab autocompletions. */
  1206:   tabAutocompleteModel?:
  1207      | CustomLLM

core/config/load.ts:
  348    // Tab autocomplete model
  349:   let tabAutocompleteModels: BaseLLM[] = [];
  350:   if (config.tabAutocompleteModel) {
  351:     tabAutocompleteModels = (
  352        await Promise.all(
  353:         (Array.isArray(config.tabAutocompleteModel)
  354:           ? config.tabAutocompleteModel
  355:           : [config.tabAutocompleteModel]
  356          ).map(async (desc) => {

  523        summarize: models,
  524:       autocomplete: [...tabAutocompleteModels],
  525        embed: newEmbedder ? [newEmbedder] : [],

core/config/onboarding.ts:
  38      ],
  39:     tabAutocompleteModel: {
  40        title: LOCAL_ONBOARDING_FIM_TITLE,

  59      ],
  60:     tabAutocompleteModel: {
  61        title: "Tab Autocomplete",

core/config/types.ts:
  1072      embeddingsProvider?: EmbeddingsProviderDescription;
  1073:     tabAutocompleteModel?: ModelDescription | ModelDescription[];
  1074      tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;

  1117      /** The model that Continue will use for tab autocompletions. */
  1118:     tabAutocompleteModel?:
  1119        | CustomLLM

  1146      embeddingsProvider: ILLM;
  1147:     tabAutocompleteModels?: ILLM[];
  1148      tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;

core/config/validation.ts:
  48    // Validate tab autocomplete model(s)
  49:   if (config.tabAutocompleteModel) {
  50:     function validateTabAutocompleteModel(modelDescription: ModelDescription) {
  51        const modelName = modelDescription.model.toLowerCase();

  71  
  72:     if (Array.isArray(config.tabAutocompleteModel)) {
  73:       config.tabAutocompleteModel.forEach(validateTabAutocompleteModel);
  74      } else {
  75:       validateTabAutocompleteModel(config.tabAutocompleteModel);
  76      }

core/config/yaml/convertFromJson.ts:
  21        // TODO
  22:       // tabAutocompleteModels
  23        // embeddingsModels

core/control-plane/schema.ts:
  128    models: z.array(modelDescriptionSchema),
  129:   tabAutocompleteModel: modelDescriptionSchema,
  130    embeddingsModel: embeddingsProviderSchema,

docs/docs/json-reference.md:
  66  
  67: ### `tabAutocompleteModel`
  68  

  74  {
  75:   "tabAutocompleteModel": {
  76      "title": "My Starcoder",

docs/docs/reference.md:
  67  
  68: ### `tabAutocompleteModel`
  69  

  75  {
  76:   "tabAutocompleteModel": {
  77      "title": "My Starcoder",

docs/docs/yaml-migration.md:
  29  
  30: Add all model configurations in `config.json`, including models in `models`, `tabAutocompleteModel`, `embeddingsProvider`, and `reranker`, to the `models` section of your new YAML config file. A new `roles` YAML field specifies which roles a model can be used for, with possible values `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize`.
  31  
  32  - `models` in config should have `roles: [chat]`
  33: - `tabAutocompleteModel`(s) in config should have `roles: [autocomplete]`
  34  - `embeddingsProvider` in config should have `roles: [embed]`

  75    ],
  76:   "tabAutocompleteModel": {
  77      "title": "My Starcoder",

docs/docs/customize/deep-dives/autocomplete.mdx:
  30    {
  31:     "tabAutocompleteModel": {
  32        "title": "Codestral",

  42  :::tip[Codestral API Key]
  43: The API keys for Codestral and the general Mistral APIs are different. If you are using Codestral, you probably want a Codestral API key, but if you are sharing the key as a team or otherwise want to use `api.mistral.ai`, then make sure to set `"apiBase": "https://api.mistral.ai/v1"` in your `tabAutocompleteModel`.
  44  :::

  72    {
  73:     "tabAutocompleteModel": {
  74        "title": "Qwen 1.5b Autocomplete Model",

docs/docs/customize/model-providers/more/cloudflare.mdx:
  70      ],
  71:     "tabAutocompleteModel": {
  72        "title": "DeepSeek 7b",

docs/docs/customize/model-providers/more/function-network.mdx:
  71    {
  72:     "tabAutocompleteModel": {
  73        "title": "Deepseek Coder 6.7b",

docs/docs/customize/model-providers/more/kindo.mdx:
  52    {
  53:     "tabAutocompleteModel": [
  54        {

docs/docs/customize/model-providers/more/siliconflow.mdx:
  70        ]
  71:       "tabAutocompleteModel": {
  72          "title": "Qwen",

docs/docs/customize/model-providers/more/vllm.mdx:
  60     {
  61:      "tabAutocompleteModel": {
  62          "title": "Qwen2.5-Coder 1.5B",

docs/docs/customize/model-providers/more/watsonx.mdx:
  197    {
  198:     "tabAutocompleteModel": {
  199        "model": "ibm/granite-8b-code-instruct",

docs/docs/customize/model-providers/top-level/azure.mdx:
  69    {
  70:     "tabAutocompleteModel": {
  71        "title": "Codestral",

docs/docs/customize/model-providers/top-level/deepseek.mdx:
  61      {
  62:       "tabAutocompleteModel": {
  63          "title": "DeepSeek Coder",

docs/docs/customize/model-providers/top-level/mistral.mdx:
  63    {
  64:     "tabAutocompleteModel": {
  65        "title": "Codestral",

docs/docs/customize/model-providers/top-level/ollama.mdx:
  56      {
  57:       "tabAutocompleteModel": {
  58          "title": "Qwen2.5-Coder 1.5B",

docs/docs/customize/model-providers/top-level/vertexai.mdx:
  67      {
  68:       "tabAutocompleteModel": {
  69            "title": "Codestral (Vertex AI)",

docs/docs/customize/tutorials/set-up-codestral.mdx:
  47        ],
  48:       "tabAutocompleteModel": {
  49          "title": "Codestral",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/reference.md:
  62  
  63: ### `tabAutocompleteModel`
  64  

  70  {
  71:   "tabAutocompleteModel": {
  72      "title": "My Starcoder",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/autocomplete/model-setup.md:
  13  {
  14:   "tabAutocompleteModel": {
  15      "title": "Codestral",

  23  :::tip[Codestral API Key]
  24: Codestral 的 API key 和通常的 Mistral API 是不同的。如果你使用 Codestral ，你可能想要一个 Codestral API key ，但是如果你想分享 key 给团队或其他人想要使用 `api.mistral.ai` ，那么确保在你的 `tabAutocompleteModel` 中设置 `"apiBase": "https://api.mistral.ai/v1"` 。
  25  :::

  32  {
  33:   "tabAutocompleteModel": {
  34      "title": "StarCoder2-3b",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/deep-dives/autocomplete.md:
  11  {
  12:   "tabAutocompleteModel": {
  13      "title": "Codestral",

  36  {
  37:     "tabAutocompleteModel": {
  38          "title": "Tab Autocomplete Model",

  52  
  53: ### `tabAutocompleteModel`
  54  

  75  {
  76:   "tabAutocompleteModel": {
  77      "title": "Tab Autocomplete Model",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/more/cloudflare.md:
  30      ...
  31:     "tabAutocompleteModel": {
  32        "accountId": "YOUR CLOUDFLARE ACCOUNT ID",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/more/kindo.md:
  23  {
  24:   "tabAutocompleteModel": [
  25      {

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/more/siliconflow.md:
  33  {
  34:   "tabAutocompleteModel": {
  35      "title": "Qwen",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/top-level/azure.md:
  27  ```json title="config.json"
  28: "tabAutocompleteModel": [{
  29      "title": "Codestral",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/top-level/deepseek.md:
  32  {
  33:   "tabAutocompleteModel": {
  34      "title": "DeepSeek Coder",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/top-level/mistral.md:
  32  {
  33:   "tabAutocompleteModel": {
  34      "title": "Codestral",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/top-level/ollama.md:
  27  {
  28:   "tabAutocompleteModel": {
  29      "title": "StarCoder2 3B",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/model-providers/top-level/vertexai.md:
  35  {
  36:   "tabAutocompleteModel": {
  37      "title": "Codestral (Vertex AI)",

docs/i18n/zh-CN/docusaurus-plugin-content-docs/current/customize/tutorials/set-up-codestral.md:
  28    ],
  29:   "tabAutocompleteModel": {
  30      "title": "Codestral",

  56    ],
  57:   "tabAutocompleteModel": {
  58      "title": "Codestral",

extensions/.continue-debug/config.json:
  56    "data": [],
  57:   "tabAutocompleteModel": {
  58      "title": "Qwen2.5-Coder 1.5B",

extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/constants/ServerConstants.kt:
  22    ],
  23:   "tabAutocompleteModel": {
  24      "title": "Codestral",

extensions/intellij/src/test/kotlin/com/github/continuedev/continueintellijextension/e2e/test-continue/config.json:
  19    },
  20:   "tabAutocompleteModel": {
  21      "title": "TEST LLM",

extensions/vscode/config_schema.json:
  3033          },
  3034:         "tabAutocompleteModel": {
  3035            "title": "Tab Autocomplete Model",

extensions/vscode/e2e/test-continue/config.json:
  72    },
  73:   "tabAutocompleteModel": {
  74      "title": "TEST LLM",

extensions/vscode/src/VsCodeIde.ts:
  158                editConfigJson((config) => {
  159:                 let tabAutocompleteModel = undefined;
  160:                 if (Array.isArray(config.tabAutocompleteModel)) {
  161:                   tabAutocompleteModel = config.tabAutocompleteModel.filter(
  162                      (model) => model.provider !== "free-trial",

  164                  } else if (
  165:                   config.tabAutocompleteModel?.provider === "free-trial"
  166                  ) {
  167:                   tabAutocompleteModel = undefined;
  168                  }

  174                    ),
  175:                   tabAutocompleteModel,
  176                  };

  222                  );
  223:                 configJson.tabAutocompleteModel = undefined;
  224                  return configJson;

packages/config-types/src/index.ts:
  217    models: z.array(modelDescriptionSchema),
  218:   tabAutocompleteModel: modelDescriptionSchema.optional(),
  219    embeddingsProvider: embeddingsProviderSchema.optional(),

packages/config-yaml/src/converter.ts:
   96    const models = configJson.models.map((m) => convertModel(m, ["chat"]));
   97:   const autocompleteModels = Array.isArray(configJson.tabAutocompleteModel)
   98:     ? configJson.tabAutocompleteModel
   99:     : configJson.tabAutocompleteModel
  100:       ? [configJson.tabAutocompleteModel]
  101        : [];
