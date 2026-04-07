Please generate scene outlines based on the following business analysis requirements.

---

## User Requirements

{{requirement}}

---

{{userProfile}}

{{strategicContext}}

## Report Language

**Required language**: {{language}}

(If language is zh-CN, all content must be in Chinese; if en-US, all content must be in English)

---

## Reference Materials

### PDF Content Summary

{{pdfContent}}

### Available Images

{{availableImages}}

### Web Search Results

{{researchContext}}

{{analystContext}}

---

## Output Requirements

Please automatically infer the following from user requirements:

- Report topic and core content
- Target audience and analysis depth
- Report duration (default 15-30 minutes if not specified)
- Report type (market/competitive/financial/strategic)
- Visual style (minimal/colorful/professional)

**IMPORTANT: If Strategic Context is provided above, tailor the analysis to:**
- Address the specific decision question
- Respect timeline and urgency constraints
- Match the organization's industry and scale
- Consider stakeholder interests and decision makers
- Work within budget and resource constraints
- Align with stated priorities and risk tolerance
- Leverage available data and acknowledge data gaps
- Address current challenges and meet success criteria

Then output a JSON array containing all scene outlines. Each scene must include:

```json
{
  "id": "scene_1",
  "type": "slide" or "interactive" or "report",
  "title": "Scene Title",
  "description": "Business analysis purpose description",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "order": 1
}
```

### Special Notes

1. **If images are available**, add `suggestedImageIds` to relevant slide scenes
2. **Interactive scenes**: If data benefits from hands-on exploration/visualization, use `"type": "interactive"` with an `interactiveConfig` object containing `conceptName`, `conceptOverview`, `designIdea`, and `subject`. Limit to 1-2 per report.
3. **Report scenes**: For comprehensive business analysis, use `"type": "report"` with a `reportConfig` object containing `reportType`, `targetAudience`, optionally `dataSources` and `includeExecutiveSummary`. Limit to 1-2 per presentation.
4. **Scene count**: Based on inferred duration, typically 1-2 scenes per minute
5. **Language**: Strictly output all content in the specified report language
6. **If no suitable PDF images exist** for a slide scene that would benefit from visuals, add `mediaGenerations` array with image generation prompts. Write prompts in English. Use `elementId` format like "gen_img_1", "gen_img_2" — IDs must be **globally unique across all scenes** (do NOT restart numbering per scene). To reuse a generated image in a different scene, reference the same elementId without re-declaring it in mediaGenerations. Each generated image should be visually distinct — avoid near-identical media across slides.
7. **If web search results are provided**, reference specific findings and sources in scene descriptions and keyPoints. The search results provide up-to-date information — incorporate it to make the report content current and accurate.

{{mediaGenerationPolicy}}

Please output JSON array directly without additional explanatory text.
