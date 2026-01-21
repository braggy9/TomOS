import { NextResponse } from 'next/server';

// Pre-built note templates for common use cases
const TEMPLATES = {
  "meeting-notes": {
    id: "meeting-notes",
    name: "Meeting Notes",
    icon: "📋",
    category: "Work",
    description: "Structured template for meeting documentation",
    template: `# Meeting: [TITLE]

**Date:** ${new Date().toLocaleDateString('en-AU')}
**Attendees:**

## Agenda
1.

## Discussion Points


## Action Items
- [ ]


## Decisions Made


## Next Meeting
**Date:**
**Agenda:**
`
  },

  "legal-research": {
    id: "legal-research",
    name: "Legal Research",
    icon: "⚖️",
    category: "Legal",
    description: "Template for legal research and case analysis",
    template: `# Legal Research: [TOPIC]

**Matter:** #matter-
**Date:** ${new Date().toLocaleDateString('en-AU')}
**Researcher:**

## Research Question


## Relevant Legislation
-


## Case Law
### [Case Name] ([Year])
**Citation:**
**Facts:**
**Holding:**
**Relevance:**


## Analysis


## Conclusion & Recommendations


## Further Research Required
- [ ]


---
**Review Date:** [Set for 30/60/90 days]
`
  },

  "client-brief": {
    id: "client-brief",
    name: "Client Brief",
    icon: "👤",
    category: "Legal",
    description: "Template for client matter briefings",
    template: `# Client Brief: [CLIENT NAME]

**Matter:** #matter-
**Date:** ${new Date().toLocaleDateString('en-AU')}
**Matter Type:**

## Background
### Client Information
- **Name:**
- **Contact:**
- **Business:**

### Matter Overview


## Key Issues
1.


## Legal Position


## Recommended Strategy


## Next Steps
- [ ]
- [ ]
- [ ]


## Timeline
**Key Dates:**


## Budget & Billing
**Fee Arrangement:**
**Estimated Cost:**


---
**Confidential** - Attorney-Client Privileged
`
  },

  "daily-log": {
    id: "daily-log",
    name: "Daily Log",
    icon: "📅",
    category: "Personal",
    description: "Daily work log and reflection",
    template: `# Daily Log - ${new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

## Top Priorities
1.
2.
3.

## Completed Today
- ✅


## In Progress
- 🔄


## Meetings & Calls
-


## Notes & Insights


## Tomorrow's Focus
1.


## Wins Today 🎉

`
  },

  "case-notes": {
    id: "case-notes",
    name: "Case Notes",
    icon: "📚",
    category: "Legal",
    description: "Template for case law documentation",
    template: `# Case Notes: [CASE NAME]

**Citation:**
**Court:**
**Date:**
**Judges:**

## Facts
### Background


### Procedural History


## Issues
1.


## Holding


## Reasoning
### Majority Opinion


### Key Points
-


## Dissent/Concurrence
*(if applicable)*


## Significance


## Application to Matters
Related to: #matter-


## Tags
Legal research, Case law, [Area of law]
`
  },

  "quick-capture": {
    id: "quick-capture",
    name: "Quick Capture",
    icon: "⚡",
    category: "General",
    description: "Simple blank note for quick thoughts",
    template: `# [TITLE]

`
  },

  "matter-strategy": {
    id: "matter-strategy",
    name: "Matter Strategy",
    icon: "🎯",
    category: "Legal",
    description: "Strategic planning for legal matters",
    template: `# Matter Strategy: [MATTER NAME]

**Matter:** #matter-
**Client:**
**Date:** ${new Date().toLocaleDateString('en-AU')}

## Objectives
### Client's Goals
1.


### Legal Objectives
1.


## Strengths
-


## Weaknesses & Risks
-


## Opposing Party Analysis
**Strengths:**
**Weaknesses:**
**Likely Strategy:**


## Our Strategy
### Phase 1:


### Phase 2:


### Phase 3:


## Resources Required
- [ ] Expert witnesses
- [ ] Discovery
- [ ] Research on [topic]


## Timeline & Milestones


## Budget Considerations


## Success Metrics


---
**Review This Strategy:** [Monthly/Quarterly]
`
  },

  "contract-review": {
    id: "contract-review",
    name: "Contract Review Notes",
    icon: "📄",
    category: "Legal",
    description: "Template for contract analysis",
    template: `# Contract Review: [CONTRACT NAME]

**Matter:** #matter-
**Client:**
**Date:** ${new Date().toLocaleDateString('en-AU')}
**Contract Date:**
**Parties:**

## Summary
**Type:**
**Term:**
**Value:**


## Key Terms
### Payment Terms


### Termination Clauses


### Liability & Indemnification


### Intellectual Property


### Confidentiality


## Issues Identified
### Critical ⚠️
1.


### Moderate ⚡
1.


### Minor 📝
1.


## Recommended Changes
1.


## Client Questions
- [ ]


## Next Steps
- [ ] Draft redlines
- [ ] Client consultation
- [ ] Negotiate with opposing counsel


---
**Status:** Draft Review / Negotiation / Final
`
  }
};

// GET /api/notes/templates - List all available templates
export async function GET() {
  try {
    const templateList = Object.values(TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      category: t.category,
      description: t.description
    }));

    // Group by category
    const categorized = templateList.reduce((acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      data: {
        templates: templateList,
        categorized
      }
    });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/notes/templates/[templateId] - Create note from template
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID required' },
        { status: 400 }
      );
    }

    const template = TEMPLATES[templateId as keyof typeof TEMPLATES];

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Replace placeholders in template
    let content = template.template;

    // Replace [TITLE] with provided title or template name
    const title = body.title || `${template.name} - ${new Date().toLocaleDateString('en-AU')}`;
    content = content.replace(/\[TITLE\]/g, title);

    // Replace other placeholders if provided
    if (body.placeholders) {
      Object.entries(body.placeholders).forEach(([key, value]) => {
        content = content.replace(new RegExp(`\\[${key}\\]`, 'g'), value as string);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        templateId: template.id,
        templateName: template.name,
        title,
        content,
        suggestedTags: [template.category.toLowerCase(), template.name.toLowerCase().replace(/\s+/g, '-')],
        isPinned: false
      }
    });

  } catch (error) {
    console.error('Error creating note from template:', error);
    return NextResponse.json(
      { error: 'Failed to create note from template' },
      { status: 500 }
    );
  }
}
