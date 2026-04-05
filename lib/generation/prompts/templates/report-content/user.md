Please generate detailed report content based on the following scene outline and configuration.

---

## Scene Outline

{{sceneOutline}}

---

## Report Configuration

{{reportConfig}}

---

## Reference Materials

### PDF Content Summary

{{pdfContent}}

### Web Search Results

{{researchContext}}

---

## Report Language

**Required language**: {{language}}

---

## Output Requirements

Generate a complete report content object with the following structure:

```json
{
  "type": "report",
  "reportType": "market" | "competitive" | "financial" | "strategic",
  "sections": [
    {
      "id": "section_1",
      "title": "Section Title",
      "content": "Detailed content...",
      "charts": [...]
    }
  ],
  "data": {
    // Additional structured data if needed
  }
}
```

### Requirements

1. Generate at least 5-8 meaningful sections
2. Each section should have 100-300 words of content
3. Include charts where appropriate (2-5 charts per report)
4. Provide actionable recommendations in final section
5. If executive summary is requested, include it as the first section
6. Use professional business language throughout

Please output JSON object directly without additional explanatory text.