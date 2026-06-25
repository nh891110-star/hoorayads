window.__POC_MOCK_GALLERY__ = [
  {
    "label": "Account Setup",
    "note": "The app starts by reducing setup anxiety: show authorization, advertiser ownership, identity readiness, and billing expectations before any campaign write happens.",
    "state": {
      "screen": "onboarding",
      "phaseLabel": "Account setup",
      "headline": "Choose the advertiser that should own this launch",
      "summary": "Hooray Marketing is connected. The next best move is to choose one advertiser, confirm the delivery identity, and only then move into product and creative selection.",
      "primaryCta": "Continue with selected advertiser",
      "secondaryCta": "Review account details",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "current",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "auth",
          "label": "Authorize TikTok Ads",
          "detail": "Use the MCP OAuth bridge so account discovery and reporting can stay inside the same app session.",
          "status": "done"
        },
        {
          "id": "account",
          "label": "Select an advertiser",
          "detail": "Show one clear account card at a time, with business center, currency, and account status.",
          "status": "current"
        },
        {
          "id": "identity",
          "label": "Confirm delivery identity",
          "detail": "Before draft creation, verify at least one usable TikTok identity under the chosen advertiser.",
          "status": "todo"
        },
        {
          "id": "billing",
          "label": "Handle payment readiness",
          "detail": "If no billing path is available, hand off in plain language rather than failing at publish.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Connected advertiser accounts",
          "value": "2",
          "tone": "good"
        },
        {
          "label": "Identity path",
          "value": "Check immediately after account selection"
        },
        {
          "label": "Billing",
          "value": "Guided TTAM handoff if missing"
        }
      ],
      "optionGroups": [
        {
          "title": "What this step should optimize for",
          "options": [
            {
              "id": "clarity",
              "title": "Reduce setup anxiety",
              "kicker": "Content design",
              "description": "Use plain-language labels like 'Which ad account should own this launch?' instead of TikTok API terminology.",
              "status": "recommended",
              "meta": [
                "Best for SMBs",
                "One decision per card"
              ]
            },
            {
              "id": "trust",
              "title": "Surface ownership early",
              "kicker": "Advertiser need",
              "description": "The user should see account name, currency, timezone, and identity count before any campaign write happens.",
              "status": "ready",
              "meta": [
                "Prevents wrong-account drafts",
                "Builds trust before publish"
              ]
            }
          ]
        }
      ],
      "readiness": {
        "accountConnection": "2 advertiser account(s) available",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Choose or generate after product selection",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "accounts": [
        {
          "advertiserId": "707500000000000001",
          "advertiserName": "Hooray DTC Footwear",
          "advertiserRole": "ADMIN",
          "bcName": "Hooray Growth Lab",
          "country": "US",
          "currency": "USD",
          "identityCount": 2,
          "status": "ACTIVE",
          "timezone": "America/Los_Angeles"
        },
        {
          "advertiserId": "707500000000000002",
          "advertiserName": "Hooray Retargeting",
          "advertiserRole": "OPERATOR",
          "bcName": "Hooray Growth Lab",
          "country": "US",
          "currency": "USD",
          "identityCount": 1,
          "status": "ACTIVE",
          "timezone": "America/Los_Angeles"
        }
      ],
      "capabilityNotes": [
        {
          "id": "account-execution",
          "title": "Account, identity, and Smart+ writes can run on TikTok MCP",
          "detail": "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Scraping and net-new creative generation still need an external media layer",
          "detail": "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
          "status": "mixed"
        },
        {
          "id": "billing-gap",
          "title": "Payment readiness is still a guided handoff",
          "detail": "There is no direct payment-readiness endpoint in the current MCP surface, so the app should escalate billing setup in plain language.",
          "status": "gap"
        }
      ]
    }
  },
  {
    "label": "Authorization Gate",
    "note": "When TikTok Ads is not connected yet, the user should see a strong blocker card and a clear authorization CTA instead of a raw error.",
    "state": {
      "screen": "onboarding",
      "phaseLabel": "Account setup",
      "headline": "Authorize TikTok Ads access to unlock the rest of the guided launch",
      "summary": "This app can already guide the campaign journey, but it still needs one TikTok authorization step before it can discover real advertiser accounts, identities, and reporting destinations.",
      "primaryCta": "Authorize TikTok Ads",
      "secondaryCta": "Why this is needed",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "current",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "auth",
          "label": "Authorize TikTok Ads",
          "detail": "Use the MCP OAuth bridge so account discovery and reporting can stay inside the same app session.",
          "status": "current"
        },
        {
          "id": "account",
          "label": "Select an advertiser",
          "detail": "Show one clear account card at a time, with business center, currency, and account status.",
          "status": "todo"
        },
        {
          "id": "identity",
          "label": "Confirm delivery identity",
          "detail": "Before draft creation, verify at least one usable TikTok identity under the chosen advertiser.",
          "status": "todo"
        },
        {
          "id": "billing",
          "label": "Handle payment readiness",
          "detail": "If no billing path is available, hand off in plain language rather than failing at publish.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Connected advertiser accounts",
          "value": "0",
          "tone": "warn"
        },
        {
          "label": "Identity path",
          "value": "Check immediately after account selection"
        },
        {
          "label": "Billing",
          "value": "Guided TTAM handoff if missing"
        }
      ],
      "optionGroups": [
        {
          "title": "What this step should optimize for",
          "options": [
            {
              "id": "clarity",
              "title": "Reduce setup anxiety",
              "kicker": "Content design",
              "description": "Use plain-language labels like 'Which ad account should own this launch?' instead of TikTok API terminology.",
              "status": "recommended",
              "meta": [
                "Best for SMBs",
                "One decision per card"
              ]
            },
            {
              "id": "trust",
              "title": "Surface ownership early",
              "kicker": "Advertiser need",
              "description": "The user should see account name, currency, timezone, and identity count before any campaign write happens.",
              "status": "ready",
              "meta": [
                "Prevents wrong-account drafts",
                "Builds trust before publish"
              ]
            }
          ]
        }
      ],
      "readiness": {
        "accountConnection": "Not authorized yet",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Choose or generate after product selection",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "capabilityNotes": [
        {
          "id": "account-execution",
          "title": "Account, identity, and Smart+ writes can run on TikTok MCP",
          "detail": "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Scraping and net-new creative generation still need an external media layer",
          "detail": "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
          "status": "mixed"
        },
        {
          "id": "billing-gap",
          "title": "Payment readiness is still a guided handoff",
          "detail": "There is no direct payment-readiness endpoint in the current MCP surface, so the app should escalate billing setup in plain language.",
          "status": "gap"
        }
      ],
      "auth": {
        "status": "needs_authorization",
        "authorizationUrl": "https://ads.tiktok.com/api/chatgpt_app/auth",
        "redirectUri": "https://mcp.hoorayads.org/callback"
      },
      "blockers": [
        {
          "id": "oauth",
          "title": "TikTok Ads authorization required",
          "detail": "Complete the authorization flow once, then return to the same Hooray TikTok Ads session and continue.",
          "severity": "high"
        }
      ]
    }
  },
  {
    "label": "Product Intake",
    "note": "The first review checkpoint confirms the landing page, product title, price, and destination before creative generation starts.",
    "state": {
      "screen": "product",
      "phaseLabel": "Product intake",
      "headline": "Confirm the product details before the app writes creative",
      "summary": "This is the first review checkpoint. The app should confirm the extracted title, price, offer, and reference images in a rich card before it starts storyboarding.",
      "primaryCta": "Looks correct",
      "secondaryCta": "Replace images",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "url",
          "label": "Landing page captured",
          "detail": "Keep the exact destination visible so the advertiser knows what creative is being based on.",
          "status": "done"
        },
        {
          "id": "copy",
          "label": "Product facts reviewed",
          "detail": "Title, price, and offer should be clean enough to feed creative generation.",
          "status": "current"
        },
        {
          "id": "images",
          "label": "Reference images approved",
          "detail": "Replace poor product photography before storyboarding starts.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Source",
          "value": "Website scrape",
          "tone": "accent"
        },
        {
          "label": "Image review",
          "value": "Needs advertiser approval"
        },
        {
          "label": "Next step",
          "value": "Storyboard generation",
          "tone": "good"
        }
      ],
      "optionGroups": [
        {
          "title": "What the UI should help the advertiser decide",
          "options": [
            {
              "id": "product-keep",
              "title": "Use detected details",
              "kicker": "Fast path",
              "description": "Best when the product page is already clean and the imagery is usable for UGC or product-demo creative.",
              "status": "recommended",
              "meta": [
                "1 click to continue",
                "Lowest friction path"
              ]
            },
            {
              "id": "product-fix",
              "title": "Correct images or offer text",
              "kicker": "Safety path",
              "description": "Give the advertiser a clean way to override weak source content without restarting the flow.",
              "status": "ready",
              "meta": [
                "Protects creative quality",
                "Avoids bad first render"
              ]
            }
          ]
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      },
      "readiness": {
        "accountConnection": "Needs TikTok Ads authorization",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Storyboard starts after image review",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "capabilityNotes": [
        {
          "id": "account-execution",
          "title": "Account, identity, and Smart+ writes can run on TikTok MCP",
          "detail": "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Scraping and net-new creative generation still need an external media layer",
          "detail": "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
          "status": "mixed"
        },
        {
          "id": "billing-gap",
          "title": "Payment readiness is still a guided handoff",
          "detail": "There is no direct payment-readiness endpoint in the current MCP surface, so the app should escalate billing setup in plain language.",
          "status": "gap"
        }
      ]
    }
  },
  {
    "label": "Product Path",
    "note": "After the product looks right, the user chooses the simplest viable launch lane. For this persona, website conversions is the default.",
    "state": {
      "screen": "product",
      "phaseLabel": "Product path",
      "headline": "Choose what the campaign is promoting before you ask for creative",
      "summary": "Advertisers think in business goals, not endpoints. The app should first ask whether they are sending traffic to a website, promoting a TikTok Shop product, collecting leads, or driving app installs. That choice determines the rest of the setup.",
      "primaryCta": "Use website path",
      "secondaryCta": "See other launch paths",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "goal",
          "label": "Lock the launch path",
          "detail": "Set the product or destination type first so the app knows whether to ask for a URL, catalog, form, or app asset.",
          "status": "current"
        },
        {
          "id": "url",
          "label": "Capture a concrete destination",
          "detail": "For website campaigns, confirm a valid landing page that creative can reference.",
          "status": "current"
        },
        {
          "id": "asset-shape",
          "label": "Translate into campaign shape",
          "detail": "Map the choice into Smart+, GMV Max, lead gen, or app promotion requirements.",
          "status": "todo"
        }
      ],
      "optionGroups": [
        {
          "title": "Promoted-product paths",
          "description": "The app should recommend the simplest viable path first, then show advanced options with their prerequisites.",
          "options": [
            {
              "id": "website",
              "title": "Website conversions",
              "kicker": "Recommended first path",
              "description": "Best default for a non-Shopify advertiser with a product page and no TikTok Shop dependency.",
              "status": "recommended",
              "meta": [
                "Needs landing page URL",
                "Maps cleanly into Smart+ website flow"
              ]
            },
            {
              "id": "shop",
              "title": "TikTok Shop / GMV Max",
              "kicker": "Advanced",
              "description": "Great when the seller already has TikTok Shop eligibility, GMV Max access, and product-level creative assets.",
              "status": "draft",
              "meta": [
                "Eligibility varies",
                "Needs shop + campaign prerequisites"
              ]
            },
            {
              "id": "lead",
              "title": "Lead generation",
              "kicker": "Use when there is no direct product URL",
              "description": "Useful for services, consultations, waitlists, or businesses that need contact capture first.",
              "status": "ready",
              "meta": [
                "Form-first experience",
                "Different publish checklist"
              ]
            },
            {
              "id": "app",
              "title": "App promotion",
              "kicker": "Separate asset track",
              "description": "Only show this if the advertiser has app IDs, tracking setup, and app events ready.",
              "status": "blocked",
              "meta": [
                "Needs app + measurement setup",
                "Do not recommend by default"
              ]
            }
          ]
        }
      ],
      "highlights": [
        {
          "label": "Selected source",
          "value": "website",
          "tone": "accent"
        },
        {
          "label": "Recommended objective",
          "value": "Smart+ Web Conversions"
        },
        {
          "label": "Destination",
          "value": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030"
        }
      ],
      "capabilityNotes": [
        {
          "id": "website-gap",
          "title": "Website product scraping is still outside TikTok Ads MCP",
          "detail": "The guided app should still own this step because it can normalize arbitrary merchant URLs into a clean creative brief.",
          "status": "mixed"
        },
        {
          "id": "gmv-max",
          "title": "TikTok Shop and GMV Max exist, but should be shown as an eligibility-based lane",
          "detail": "This path is powerful, but it should appear only when shop, store, and campaign prerequisites are actually met.",
          "status": "mixed"
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "Pending merchant price",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      },
      "readiness": {
        "accountConnection": "Authorize first or reuse connected advertiser",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Choose or generate after product path is locked",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "blockers": []
    }
  },
  {
    "label": "Creative Source",
    "note": "The app then offers three rich paths: reuse an existing TikTok post, build from product media, or generate a fresh storyboard.",
    "state": {
      "screen": "creative",
      "phaseLabel": "Creative source",
      "headline": "Let the advertiser choose between reusing content and generating something new",
      "summary": "A good advertiser experience should not force one creative path. The app should present three lanes: reuse an existing TikTok post, start from approved product assets, or generate a fresh storyboard and video.",
      "primaryCta": "Generate new creative",
      "secondaryCta": "Reuse existing TikTok post",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "current",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "lane",
          "label": "Pick a creative lane",
          "detail": "Start with a simple choice between existing content and net-new generation.",
          "status": "current"
        },
        {
          "id": "review",
          "label": "Review the concept",
          "detail": "Before rendering or selecting a post, show the advertiser the angle, hook, and CTA in plain language.",
          "status": "todo"
        },
        {
          "id": "asset",
          "label": "Lock the launch asset",
          "detail": "Only after approval should the campaign use a video ID or rendered output.",
          "status": "todo"
        }
      ],
      "optionGroups": [
        {
          "title": "Creative lanes",
          "description": "Each lane should feel like a deliberate product choice, not an API fallback.",
          "options": [
            {
              "id": "generate",
              "title": "Generate a fresh ad",
              "kicker": "Recommended for first launch",
              "description": "Use the product page, approved images, and a clear business goal to create a storyboard and then a rendered preview.",
              "status": "recommended",
              "meta": [
                "Best for new advertisers",
                "Keeps the app differentiated"
              ]
            },
            {
              "id": "reuse",
              "title": "Reuse an existing TikTok post",
              "kicker": "MCP-backed asset path",
              "description": "Once identity access is ready, the app can guide the user to pick a usable post instead of generating from scratch.",
              "status": "ready",
              "meta": [
                "Maps to identity_video_get",
                "Needs a usable identity first"
              ]
            },
            {
              "id": "hybrid",
              "title": "Start from existing product media",
              "kicker": "Fast creative iteration",
              "description": "Best when the advertiser has decent product imagery but still wants the app to script and package the ad.",
              "status": "ready",
              "meta": [
                "Good for DTC products",
                "Keeps visual review inside ChatGPT"
              ]
            }
          ]
        }
      ],
      "creativeAssets": [
        {
          "id": "asset-1",
          "title": "Pain-to-comfort UGC",
          "source": "Generated storyboard",
          "description": "Hook the viewer with the problem first, then reveal Nike Men's Air Max LTD 3 Sneaker - Grey/Black as the relief moment.",
          "status": "recommended",
          "meta": [
            "Best for conversion",
            "2-scene vertical video",
            "Direct CTA"
          ]
        },
        {
          "id": "asset-2",
          "title": "Existing TikTok post reuse",
          "source": "Identity video library",
          "description": "Use this lane when the brand already has a post with strong watch time or social proof.",
          "status": "available",
          "meta": [
            "Requires identity selection",
            "Maps to MCP asset discovery"
          ]
        },
        {
          "id": "asset-3",
          "title": "Thumbnail + CTA polish",
          "source": "Creative enhancement",
          "description": "After a video ID exists, the app can guide thumbnail and CTA cleanup so the creative feels launch-ready.",
          "status": "needs_input",
          "meta": [
            "Needs real video ID",
            "Maps partly to file_video_suggestcover_get"
          ]
        }
      ],
      "angles": [
        {
          "id": "hook-01",
          "title": "Pain-to-comfort switch",
          "hook": "Start with the problem, then pivot hard into the product payoff with one spoken line and one tactile reveal.",
          "format": "2-scene UGC",
          "targetObjective": "Web Conversions"
        },
        {
          "id": "hook-02",
          "title": "Proof-first social clip",
          "hook": "Open on a believable proof point or social cue, then move quickly into the product benefit and click reason.",
          "format": "Identity-post reuse",
          "targetObjective": "Landing page views"
        }
      ],
      "highlights": [
        {
          "label": "Preferred lane",
          "value": "Generate new creative",
          "tone": "accent"
        },
        {
          "label": "Reuse lane",
          "value": "Existing TikTok post if identity is connected"
        },
        {
          "label": "Approval rule",
          "value": "Never render or publish before explicit review",
          "tone": "good"
        }
      ],
      "readiness": {
        "accountConnection": "Needs TikTok Ads authorization",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Creative lane selected, final asset still pending",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "capabilityNotes": [
        {
          "id": "creative-live",
          "title": "Existing post reuse is the strongest MCP-native creative path today",
          "detail": "Identity-based post discovery is a natural bridge between TikTok-native content and campaign creation.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Generated storyboard and render remain the signature ChatGPT layer",
          "detail": "This is where the app adds the most product value beyond Ads Manager.",
          "status": "mixed"
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      }
    }
  },
  {
    "label": "Storyboard Review",
    "note": "This is the editorial checkpoint. The advertiser reviews hook, scene framing, and CTA before any render or ad draft is started.",
    "state": {
      "screen": "creative",
      "phaseLabel": "Creative source",
      "headline": "Storyboard draft ready for review",
      "summary": "At this moment the UI should feel editorial, not technical. The advertiser should only be deciding whether the hook, scene framing, and CTA feel right for the business.",
      "primaryCta": "Approve storyboard",
      "secondaryCta": "Change the hook",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "current",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "lane",
          "label": "Pick a creative lane",
          "detail": "Start with a simple choice between existing content and net-new generation.",
          "status": "current"
        },
        {
          "id": "review",
          "label": "Review the concept",
          "detail": "Before rendering or selecting a post, show the advertiser the angle, hook, and CTA in plain language.",
          "status": "todo"
        },
        {
          "id": "asset",
          "label": "Lock the launch asset",
          "detail": "Only after approval should the campaign use a video ID or rendered output.",
          "status": "todo"
        }
      ],
      "optionGroups": [
        {
          "title": "Creative lanes",
          "description": "Each lane should feel like a deliberate product choice, not an API fallback.",
          "options": [
            {
              "id": "generate",
              "title": "Generate a fresh ad",
              "kicker": "Recommended for first launch",
              "description": "Use the product page, approved images, and a clear business goal to create a storyboard and then a rendered preview.",
              "status": "recommended",
              "meta": [
                "Best for new advertisers",
                "Keeps the app differentiated"
              ]
            },
            {
              "id": "reuse",
              "title": "Reuse an existing TikTok post",
              "kicker": "MCP-backed asset path",
              "description": "Once identity access is ready, the app can guide the user to pick a usable post instead of generating from scratch.",
              "status": "ready",
              "meta": [
                "Maps to identity_video_get",
                "Needs a usable identity first"
              ]
            },
            {
              "id": "hybrid",
              "title": "Start from existing product media",
              "kicker": "Fast creative iteration",
              "description": "Best when the advertiser has decent product imagery but still wants the app to script and package the ad.",
              "status": "ready",
              "meta": [
                "Good for DTC products",
                "Keeps visual review inside ChatGPT"
              ]
            }
          ]
        }
      ],
      "creativeAssets": [
        {
          "id": "asset-1",
          "title": "Pain-to-comfort UGC",
          "source": "Generated storyboard",
          "description": "Hook the viewer with the problem first, then reveal Nike Men's Air Max LTD 3 Sneaker - Grey/Black as the relief moment.",
          "status": "recommended",
          "meta": [
            "Best for conversion",
            "2-scene vertical video",
            "Direct CTA"
          ]
        },
        {
          "id": "asset-2",
          "title": "Existing TikTok post reuse",
          "source": "Identity video library",
          "description": "Use this lane when the brand already has a post with strong watch time or social proof.",
          "status": "available",
          "meta": [
            "Requires identity selection",
            "Maps to MCP asset discovery"
          ]
        },
        {
          "id": "asset-3",
          "title": "Thumbnail + CTA polish",
          "source": "Creative enhancement",
          "description": "After a video ID exists, the app can guide thumbnail and CTA cleanup so the creative feels launch-ready.",
          "status": "needs_input",
          "meta": [
            "Needs real video ID",
            "Maps partly to file_video_suggestcover_get"
          ]
        }
      ],
      "angles": [
        {
          "id": "hook-01",
          "title": "Pain-to-comfort switch",
          "hook": "Start with the problem, then pivot hard into the product payoff with one spoken line and one tactile reveal.",
          "format": "2-scene UGC",
          "targetObjective": "Web Conversions"
        },
        {
          "id": "hook-02",
          "title": "Proof-first social clip",
          "hook": "Open on a believable proof point or social cue, then move quickly into the product benefit and click reason.",
          "format": "Identity-post reuse",
          "targetObjective": "Landing page views"
        }
      ],
      "highlights": [
        {
          "label": "Preferred lane",
          "value": "Generate new creative",
          "tone": "accent"
        },
        {
          "label": "Reuse lane",
          "value": "Existing TikTok post if identity is connected"
        },
        {
          "label": "Approval rule",
          "value": "Never render or publish before explicit review",
          "tone": "good"
        }
      ],
      "readiness": {
        "accountConnection": "Needs TikTok Ads authorization",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Creative lane selected, final asset still pending",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "capabilityNotes": [
        {
          "id": "creative-live",
          "title": "Existing post reuse is the strongest MCP-native creative path today",
          "detail": "Identity-based post discovery is a natural bridge between TikTok-native content and campaign creation.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Generated storyboard and render remain the signature ChatGPT layer",
          "detail": "This is where the app adds the most product value beyond Ads Manager.",
          "status": "mixed"
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      }
    }
  },
  {
    "label": "Render + Account Handoff",
    "note": "Once approved, the experience moves into background rendering, then lands on advertiser/identity setup with explicit ownership signals.",
    "state": {
      "screen": "onboarding",
      "phaseLabel": "Account setup",
      "headline": "Connected account is ready for identity and product setup",
      "summary": "The TikTok Ads connection is live. The next best move is to verify the identity path and move this advertiser into product and creative setup.",
      "primaryCta": "Continue with this advertiser",
      "secondaryCta": "Review details",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "current",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "auth",
          "label": "Authorize TikTok Ads",
          "detail": "The app can now read real advertiser data.",
          "status": "done"
        },
        {
          "id": "account",
          "label": "Choose advertiser owner",
          "detail": "Make the selected account visible and explicit before the app writes anything.",
          "status": "current"
        },
        {
          "id": "identity",
          "label": "Confirm delivery identity",
          "detail": "If no identity exists, route into identity setup before creative or draft creation.",
          "status": "done"
        },
        {
          "id": "billing",
          "label": "Prepare billing handoff",
          "detail": "Keep payment readiness visible as a guided pre-publish task.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Advertiser accounts",
          "value": "1",
          "tone": "accent"
        },
        {
          "label": "Selected identities",
          "value": "1",
          "tone": "good"
        },
        {
          "label": "Recommended next step",
          "value": "Choose product path"
        }
      ],
      "accounts": [
        {
          "advertiserId": "707500000000000001",
          "advertiserName": "Hooray DTC Footwear",
          "advertiserRole": "ADMIN",
          "bcName": "Hooray Growth Lab",
          "country": "US",
          "currency": "USD",
          "identityCount": 2,
          "status": "ACTIVE",
          "timezone": "America/Los_Angeles"
        }
      ],
      "identities": [
        {
          "availableStatus": "AVAILABLE",
          "displayName": "Hooray Shoes",
          "identityId": "identity_001",
          "identityType": "TT_USER",
          "username": "hoorayshoes"
        }
      ],
      "readiness": {
        "accountConnection": "1 advertiser account(s) available",
        "identity": "1 usable identity found",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Choose or generate after product selection",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "optionGroups": [
        {
          "title": "Why this step matters",
          "options": [
            {
              "id": "ownership",
              "title": "Prevent wrong-account drafts",
              "kicker": "Advertiser need",
              "description": "A guided account selection step is more trustworthy than hidden account context.",
              "status": "recommended",
              "meta": [
                "Reduces support load",
                "Avoids destructive mistakes"
              ]
            },
            {
              "id": "identity-reuse",
              "title": "Unlock existing TikTok post reuse",
              "kicker": "Creative payoff",
              "description": "Once identity is known, the app can recommend existing TikTok posts as creative candidates.",
              "status": "ready",
              "meta": [
                "Connects setup to creative flow",
                "Feels distinctly TikTok-native"
              ]
            }
          ]
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      },
      "capabilityNotes": [
        {
          "id": "account-execution",
          "title": "Account, identity, and Smart+ writes can run on TikTok MCP",
          "detail": "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Scraping and net-new creative generation still need an external media layer",
          "detail": "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
          "status": "mixed"
        },
        {
          "id": "billing-gap",
          "title": "Payment readiness is still a guided handoff",
          "detail": "There is no direct payment-readiness endpoint in the current MCP surface, so the app should escalate billing setup in plain language.",
          "status": "gap"
        }
      ]
    }
  },
  {
    "label": "Draft Review",
    "note": "The Smart+ draft review card summarizes launch readiness in plain language so a first-launch advertiser can approve confidently.",
    "state": {
      "screen": "draft",
      "phaseLabel": "Review + publish",
      "headline": "Smart+ draft is ready for review inside the guided launch workspace",
      "summary": "This review step should feel like a launch checklist, not a settings dump: budget, country, identity, creative, and publish risk in one clean card.",
      "primaryCta": "Approve parameters",
      "secondaryCta": "Adjust settings",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "draft",
          "label": "Draft objects created",
          "detail": "Campaign, ad group, and ad IDs should be clearly visible when available.",
          "status": "done"
        },
        {
          "id": "review",
          "label": "Review launch settings",
          "detail": "Budget, geo, CTA, landing page, and identity should be legible in one place.",
          "status": "current"
        },
        {
          "id": "publish",
          "label": "Publish only after explicit approval",
          "detail": "Keep the user in control of the final go-live step.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Draft status",
          "value": "draft ready",
          "tone": "good"
        },
        {
          "label": "Campaign ID",
          "value": "cmp_50001"
        },
        {
          "label": "Ad ID",
          "value": "ad_90001"
        }
      ],
      "readiness": {
        "accountConnection": "Selected advertiser ready",
        "identity": "Connected and usable",
        "payment": "Check before enabling delivery",
        "video": "Launch asset attached",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "draft": {
        "name": "Nike Air Max LTD 3 | Smart+ | US",
        "objective": "Web Conversions",
        "fields": [
          {
            "label": "Campaign ID",
            "value": "cmp_50001",
            "editable": false
          },
          {
            "label": "Ad group ID",
            "value": "ag_70001",
            "editable": false
          },
          {
            "label": "Ad ID",
            "value": "ad_90001",
            "editable": false
          },
          {
            "label": "Daily budget",
            "value": "$80",
            "editable": true
          },
          {
            "label": "Country",
            "value": "US",
            "editable": true
          },
          {
            "label": "Optimization goal",
            "value": "Landing page views",
            "editable": true
          },
          {
            "label": "Bidding strategy",
            "value": "Maximum delivery",
            "editable": true
          }
        ],
        "warnings": [
          "If payment is missing, the app should return a clear TTAM handoff instead of a raw API error.",
          "Only publish after explicit user approval of campaign parameters."
        ]
      },
      "optionGroups": [
        {
          "title": "How to present draft review",
          "options": [
            {
              "id": "review-one",
              "title": "Show a launch summary, not raw JSON",
              "kicker": "Content design",
              "description": "Keep the review card human-readable so the advertiser can approve quickly and with confidence.",
              "status": "recommended",
              "meta": [
                "One page summary",
                "Explicit publish control"
              ]
            },
            {
              "id": "review-two",
              "title": "Escalate missing setup in-place",
              "kicker": "Support design",
              "description": "If a real blocker exists, show it in the draft review card so the user understands exactly why publish is paused.",
              "status": "ready",
              "meta": [
                "No hidden failures",
                "Better than a late error"
              ]
            }
          ]
        }
      ],
      "capabilityNotes": [
        {
          "id": "account-execution",
          "title": "Account, identity, and Smart+ writes can run on TikTok MCP",
          "detail": "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
          "status": "live"
        },
        {
          "id": "creative-gap",
          "title": "Scraping and net-new creative generation still need an external media layer",
          "detail": "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
          "status": "mixed"
        },
        {
          "id": "billing-gap",
          "title": "Payment readiness is still a guided handoff",
          "detail": "There is no direct payment-readiness endpoint in the current MCP surface, so the app should escalate billing setup in plain language.",
          "status": "gap"
        }
      ],
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      }
    }
  },
  {
    "label": "Launch Complete",
    "note": "After publish, the UI shifts into a success and follow-through posture: celebrate briefly, confirm the campaign, and set expectations.",
    "state": {
      "screen": "publish",
      "phaseLabel": "Launch complete",
      "headline": "Campaign submitted successfully, and the next best move is follow-through",
      "summary": "A strong launch state should celebrate briefly, confirm the campaign ID, and immediately guide the advertiser into reporting expectations so they know what success looks like next.",
      "primaryCta": "Set up reporting digest",
      "secondaryCta": "View in Ads Manager",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "todo",
          "owner": "chatgpt"
        }
      ],
      "highlights": [
        {
          "label": "Launch state",
          "value": "Submitted",
          "tone": "good"
        },
        {
          "label": "Campaign",
          "value": "spc_poc_20260624_001"
        },
        {
          "label": "Recommended follow-up",
          "value": "Weekly digest",
          "tone": "accent"
        }
      ],
      "publish": {
        "state": "submitted",
        "campaignId": "spc_poc_20260624_001",
        "nextCheckIn": "Tell the advertiser that learning and performance signals usually need time to stabilize before major changes."
      },
      "reportPlan": {
        "cadence": "weekly",
        "delivery": "ChatGPT digest",
        "nextRun": "Next Monday at 9:00 AM advertiser time",
        "focus": "conversion",
        "metrics": [
          "spend",
          "CTR",
          "landing page views",
          "CPA / conversion quality"
        ],
        "notes": [
          "The first digest should explain whether the campaign is delivering cleanly before recommending optimization.",
          "Keep the first report lightweight and focused on trust-building, not dashboard overload."
        ]
      },
      "capabilityNotes": [
        {
          "id": "launch-to-report",
          "title": "The publish step should naturally hand off into reporting setup",
          "detail": "That follow-through is part of the product, not an afterthought.",
          "status": "live"
        }
      ],
      "readiness": {
        "accountConnection": "Live advertiser selected",
        "identity": "Live identity attached",
        "payment": "Assumed ready for launch",
        "video": "Live creative attached",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "product": {
        "title": "Nike Men's Air Max LTD 3 Sneaker - Grey/Black",
        "price": "$129",
        "destination": "https://www.famousfootwear.com/product/nike-mens-air-max-ltd-3-sneaker-1054683/grey-black-74030",
        "platform": "Direct product URL"
      }
    }
  },
  {
    "label": "Reporting Follow-Through",
    "note": "The journey ends by setting a simple reporting lane so the advertiser knows what happens next and when to come back.",
    "state": {
      "screen": "reporting",
      "phaseLabel": "Reporting follow-through",
      "headline": "Set up a reporting lane while the launch context is still fresh",
      "summary": "Most advertisers do not just need a campaign published. They need a light-touch follow-up lane that tells them what happened, what to change, and when to come back. This is where the app should set that expectation and wire the right reporting mode.",
      "primaryCta": "Save reporting plan",
      "secondaryCta": "Compare delivery options",
      "timeline": [
        {
          "id": "onboarding",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "product",
          "label": "Choose product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Creative source",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Campaign setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review + publish",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "reporting",
          "label": "Reporting setup",
          "status": "current",
          "owner": "chatgpt"
        }
      ],
      "checklist": [
        {
          "id": "focus",
          "label": "Choose the first reporting lens",
          "detail": "Start with the question the advertiser cares about most: delivery, creative, or conversions.",
          "status": "current"
        },
        {
          "id": "cadence",
          "label": "Choose a reporting cadence",
          "detail": "Default to weekly for most SMB advertisers; daily only when they are actively learning or troubleshooting.",
          "status": "current"
        },
        {
          "id": "delivery",
          "label": "Choose delivery mode",
          "detail": "Let the user pick between in-chat digests, async exports, or webhooks if the integration is ready.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Cadence",
          "value": "weekly",
          "tone": "accent"
        },
        {
          "label": "Delivery mode",
          "value": "chatgpt digest"
        },
        {
          "label": "Focus",
          "value": "conversion",
          "tone": "good"
        }
      ],
      "optionGroups": [
        {
          "title": "Reporting delivery modes",
          "description": "Different advertisers need different levels of fidelity and automation.",
          "options": [
            {
              "id": "digest",
              "title": "ChatGPT digest",
              "kicker": "Recommended default",
              "description": "A friendly recurring summary with a few metrics, a diagnosis, and 1-2 next actions is the best first reporting experience for most advertisers.",
              "status": "recommended",
              "meta": [
                "Best for SMBs",
                "Needs thread-side scheduling"
              ]
            },
            {
              "id": "export",
              "title": "Async export",
              "kicker": "Ops-friendly",
              "description": "Good for agencies or analysts who want a CSV/XLSX task and will review the data outside the chat flow.",
              "status": "ready",
              "meta": [
                "Maps to report_task_create",
                "Good for larger accounts"
              ]
            },
            {
              "id": "webhook",
              "title": "Webhook subscription",
              "kicker": "Advanced / allowlist-sensitive",
              "description": "Great when the integration wants push-style updates, but this path needs a durable callback service and may be allowlist-limited.",
              "status": "blocked",
              "meta": [
                "Maps to subscription_subscribe_create",
                "Not the best default UX"
              ]
            }
          ]
        }
      ],
      "reportPlan": {
        "cadence": "weekly",
        "delivery": "chatgpt digest",
        "nextRun": "Next Monday at 9:00 AM advertiser time",
        "focus": "conversion",
        "metrics": [
          "clicks",
          "landing page views",
          "CPA / conversion signals"
        ],
        "notes": [
          "Use synchronous integrated reports for lightweight in-chat summaries.",
          "Use async report tasks when the user wants exportable files or larger result sets.",
          "Use webhook subscriptions only when the integration is ready for a callback-based reporting lane."
        ]
      },
      "capabilityNotes": [
        {
          "id": "reports-live",
          "title": "Reporting APIs are one of the strongest MCP-backed surfaces",
          "detail": "Synchronous reports, async exports, and benchmark-style follow-ups are all feasible paths for a guided reporting experience.",
          "status": "live"
        },
        {
          "id": "webhook-caution",
          "title": "Webhook-driven reporting needs extra product plumbing",
          "detail": "It is powerful, but it should not be the default until callback reliability, scheduling, and notification UX are in place.",
          "status": "mixed"
        }
      ],
      "readiness": {
        "accountConnection": "Advertiser 707500000000000001",
        "identity": "No longer the main risk",
        "payment": "Not relevant for reporting",
        "video": "Use creative metrics only when the asset is live",
        "recommendedObjective": "Smart+ Web Conversions"
      }
    }
  }
];
