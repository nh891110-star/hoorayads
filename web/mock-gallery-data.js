window.__POC_MOCK_GALLERY__ = [
  {
    "label": "Start",
    "state": {
      "screen": "product",
      "phaseLabel": "Product",
      "headline": "What do you want to promote?",
      "summary": "",
      "primaryCta": "Confirm",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
        }
      ]
    }
  },
  {
    "label": "Store scan",
    "state": {
      "screen": "product",
      "phaseLabel": "Product",
      "headline": "Finding products ready for TikTok ads.",
      "summary": "Scanning your store page for products with strong visuals, clear offers, usable landing pages, and short-video storytelling potential.",
      "primaryCta": "Scanning store",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "current",
          "owner": "user",
          "substeps": [
            {
              "label": "Pick product",
              "status": "current"
            },
            {
              "label": "Confirm product",
              "status": "todo"
            }
          ]
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
        }
      ],
      "checklist": [
        {
          "id": "store-url",
          "label": "Store URL received",
          "detail": "https://yourstore.com",
          "status": "done"
        },
        {
          "id": "scan-products",
          "label": "Find product candidates",
          "detail": "Review visible store signals, product-page quality, and creative fit.",
          "status": "current"
        },
        {
          "id": "confirm-product",
          "label": "Confirm one product",
          "detail": "After you pick a candidate, we will confirm the product page and images before storyboarding.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Store",
          "value": "yourstore.com",
          "tone": "accent"
        },
        {
          "label": "Ranking",
          "value": "Ad-readiness signals"
        },
        {
          "label": "Next",
          "value": "Pick one product",
          "tone": "good"
        }
      ],
      "readiness": {
        "accountConnection": "Not needed yet",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Starts after product confirmation",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "storeDiscovery": {
        "status": "loading",
        "storeUrl": "https://yourstore.com",
        "rankingBasis": [
          "Visual fit",
          "Clear offer",
          "Landing page quality",
          "Short-video potential"
        ],
        "note": "This scan uses visible store-page signals. It is not a sales forecast."
      }
    }
  },
  {
    "label": "Pick product",
    "state": {
      "screen": "product",
      "phaseLabel": "Product",
      "headline": "Pick a product to promote.",
      "summary": "I found 2 products from your store that look ready to promote on TikTok. Choose one.",
      "primaryCta": "Use selected product",
      "secondaryCta": "Show more candidates",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "current",
          "owner": "user",
          "substeps": [
            {
              "label": "Pick product",
              "status": "current"
            },
            {
              "label": "Confirm product",
              "status": "todo"
            }
          ]
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
        }
      ],
      "checklist": [
        {
          "id": "store-url",
          "label": "Store URL scanned",
          "detail": "https://yourstore.com",
          "status": "done"
        },
        {
          "id": "pick-product",
          "label": "Pick one product",
          "detail": "Choose the product that should move into product confirmation and storyboard generation.",
          "status": "current"
        },
        {
          "id": "confirm-product",
          "label": "Confirm product page and images",
          "detail": "The next screen checks the selected product details before any video is created.",
          "status": "todo"
        }
      ],
      "highlights": [
        {
          "label": "Top pick",
          "value": "Portable Neck Fan",
          "tone": "accent"
        },
        {
          "label": "Candidates",
          "value": "2",
          "tone": "good"
        },
        {
          "label": "Recommendation",
          "value": "Strong match"
        }
      ],
      "product": {
        "title": "Portable Neck Fan",
        "price": "Needs confirmation",
        "destination": "https://yourstore.com/products/portable-neck-fan",
        "platform": "Store URL discovery"
      },
      "readiness": {
        "accountConnection": "Not needed yet",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Starts after product confirmation",
        "recommendedObjective": "Smart+ Web Conversions"
      },
      "storeDiscovery": {
        "status": "ready",
        "storeUrl": "https://yourstore.com",
        "candidates": [
          {
            "angle": "Hands-free cooling for hot commutes.",
            "confidence": "Strong match",
            "id": "portable-neck-fan",
            "productUrl": "https://yourstore.com/products/portable-neck-fan",
            "recommendation": "Top pick",
            "reasons": [
              "Clear seasonal use case and easy visual demo.",
              "Benefit is understandable in the first 2 seconds.",
              "Product page can support a simple shop-now CTA."
            ],
            "selected": true,
            "title": "Portable Neck Fan"
          },
          {
            "angle": "30-second couch cleanup before/after.",
            "confidence": "Good potential",
            "id": "pet-hair-remover-brush",
            "productUrl": "https://yourstore.com/products/pet-hair-remover-brush",
            "recommendation": "Candidate",
            "reasons": [
              "Before/after cleanup is easy to show in short video.",
              "Audience is specific: pet owners with sofas, rugs, or cars.",
              "Strong demonstration potential if product footage is available."
            ],
            "title": "Pet Hair Remover Brush"
          }
        ],
        "selectedCandidateId": "portable-neck-fan",
        "rankingBasis": [
          "Visual fit",
          "Clear offer",
          "Landing page quality",
          "Short-video potential"
        ],
        "note": "These are recommendations from visible store-page signals, not sales predictions."
      }
    }
  },
  {
    "label": "Confirm product",
    "state": {
      "screen": "product",
      "phaseLabel": "Product",
      "headline": "Confirm this product.",
      "summary": "We found this from your URL. Check the name, page, and images before we make the ad.",
      "primaryCta": "Confirm product",
      "secondaryCta": "Edit details",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "current",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
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
        "title": "Coach Brooklyn Shoulder Bag 28",
        "price": "$295",
        "destination": "https://coach.com/products/brooklyn-shoulder-bag-28",
        "platform": "Direct product URL",
        "imageCount": 3
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
          "title": "Payment readiness is checked before publish",
          "detail": "If billing needs attention, the app should guide the advertiser before anything goes live.",
          "status": "gap"
        }
      ]
    }
  },
  {
    "label": "Storyboard",
    "state": {
      "screen": "creative",
      "phaseLabel": "Storyboard",
      "headline": "Pick a storyboard.",
      "summary": "I drafted two story directions from the product page. Choose one, then preview the video.",
      "primaryCta": "Use selected storyboard",
      "secondaryCta": "Regenerate options",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "current",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
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
          "title": "Everyday style switch",
          "source": "Generated storyboard",
          "description": "Hook the viewer with the problem first, then reveal Coach Brooklyn Shoulder Bag 28 as the relief moment.",
          "status": "recommended",
          "meta": [
            "User-guided direction",
            "12s vertical video",
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
          "title": "Everyday style switch",
          "hook": "One bag, three easy outfits.",
          "format": "12s vertical video",
          "targetObjective": "Shop the Brooklyn Bag"
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
          "label": "Creative direction",
          "value": "Everyday style switch",
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
        "title": "Coach Brooklyn Shoulder Bag 28",
        "price": "$295",
        "destination": "https://coach.com/products/brooklyn-shoulder-bag-28",
        "platform": "Direct product URL",
        "creativeBriefFormat": "12s vertical video",
        "creativeBriefHook": "One bag, three easy outfits.",
        "creativeBriefObjective": "Shop the Brooklyn Bag",
        "creativeBriefTitle": "Everyday style switch",
        "imageCount": 3
      }
    }
  },
  {
    "label": "Generating preview",
    "state": {
      "screen": "render",
      "phaseLabel": "Preview",
      "headline": "Generating your video preview.",
      "summary": "I’m turning the selected storyboard into a short draft. Nothing is connected to TikTok Ads yet.",
      "primaryCta": "Check render status",
      "secondaryCta": "Edit storyboard",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "current",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
        }
      ],
      "checklist": [
        {
          "id": "lane",
          "label": "Creative lane selected",
          "detail": "The advertiser already approved the concept, so rendering can happen asynchronously.",
          "status": "done"
        },
        {
          "id": "render",
          "label": "Generate preview asset",
          "detail": "Poll for completion and keep the user in the same workspace.",
          "status": "current"
        },
        {
          "id": "review",
          "label": "Move into campaign setup",
          "detail": "Only once the preview exists should the app ask for final campaign inputs.",
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
          "title": "Everyday style switch",
          "source": "Generated storyboard",
          "description": "Hook the viewer with the problem first, then reveal Coach Brooklyn Shoulder Bag 28 as the relief moment.",
          "status": "recommended",
          "meta": [
            "User-guided direction",
            "12s vertical video",
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
          "title": "Everyday style switch",
          "hook": "One bag, three easy outfits.",
          "format": "12s vertical video",
          "targetObjective": "Shop the Brooklyn Bag"
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
          "label": "Creative direction",
          "value": "Everyday style switch",
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
        "video": "Preview rendering in progress",
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
        "title": "Coach Brooklyn Shoulder Bag 28",
        "price": "$295",
        "destination": "https://coach.com/products/brooklyn-shoulder-bag-28",
        "platform": "Direct product URL",
        "creativeBriefFormat": "12s vertical video",
        "creativeBriefHook": "One bag, three easy outfits.",
        "creativeBriefObjective": "Shop the Brooklyn Bag",
        "creativeBriefTitle": "Everyday style switch",
        "imageCount": 3
      }
    }
  },
  {
    "label": "Preview",
    "state": {
      "screen": "render",
      "phaseLabel": "Preview",
      "headline": "Preview the video.",
      "summary": "Review the selected storyboard as a short draft. Nothing is connected to TikTok Ads yet.",
      "primaryCta": "Approve preview",
      "secondaryCta": "Edit storyboard",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "current",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "todo",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
        }
      ],
      "checklist": [
        {
          "id": "concept",
          "label": "Storyboard approved",
          "detail": "The hook, product framing, and CTA were approved before rendering.",
          "status": "done"
        },
        {
          "id": "preview",
          "label": "Preview video ready",
          "detail": "Watch the generated preview and confirm it is launch-worthy.",
          "status": "current"
        },
        {
          "id": "campaign",
          "label": "Continue to campaign setup",
          "detail": "After preview approval, attach the asset context to the Smart+ draft flow.",
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
          "title": "Everyday style switch",
          "source": "Generated storyboard",
          "description": "Hook the viewer with the problem first, then reveal Coach Brooklyn Shoulder Bag 28 as the relief moment.",
          "status": "recommended",
          "meta": [
            "User-guided direction",
            "12s vertical video",
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
          "title": "Everyday style switch",
          "hook": "One bag, three easy outfits.",
          "format": "12s vertical video",
          "targetObjective": "Shop the Brooklyn Bag"
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
          "label": "Preview",
          "value": "12s vertical",
          "tone": "good"
        },
        {
          "label": "Asset",
          "value": "video_preview_demo",
          "tone": "accent"
        },
        {
          "label": "TikTok upload",
          "value": "Needed before publish",
          "tone": "warn"
        }
      ],
      "readiness": {
        "accountConnection": "Needs TikTok Ads authorization",
        "identity": "Will verify after account selection",
        "payment": "Confirm in Ads Manager before publish",
        "video": "Preview ready for review",
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
        "title": "Coach Brooklyn Shoulder Bag 28",
        "price": "$295",
        "destination": "https://coach.com/products/brooklyn-shoulder-bag-28",
        "platform": "Direct product URL",
        "imageCount": 3,
        "creativeBriefTitle": "Everyday style switch",
        "creativeBriefHook": "One bag, three easy outfits.",
        "creativeBriefFormat": "12s vertical video",
        "creativeBriefObjective": "Shop the Brooklyn Bag"
      },
      "blockers": [
        {
          "id": "tiktok-upload",
          "title": "Preview is not a TikTok-hosted video yet",
          "detail": "The app can show the rendered preview now. Before final ad creative creation or publish, the renderer still needs to upload the MP4 to TikTok and return a real TikTok video_id.",
          "severity": "medium"
        }
      ],
      "videoPreview": {
        "canCreateCampaign": true,
        "creativeAssetId": "creative_asset_video_job_demo",
        "durationSeconds": 12,
        "height": 960,
        "jobId": "video_job_demo",
        "previewUrl": "/assets/mock-render-preview.mp4",
        "status": "preview_ready",
        "thumbnailUrl": "/assets/mock-render-poster.svg",
        "videoId": "video_preview_demo",
        "width": 540
      }
    }
  },
  {
    "label": "Account setup",
    "state": {
      "screen": "onboarding",
      "phaseLabel": "Account setup",
      "headline": "Account setup.",
      "summary": "Connect TikTok Ads so Hooray can find the right Business Center, advertiser account, and TikTok Account.",
      "primaryCta": "Authorize TikTok Ads",
      "secondaryCta": "Why this is needed",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "todo",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "todo",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "current",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "todo",
          "owner": "user"
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
          "id": "tiktok_account",
          "label": "Confirm TikTok Account",
          "detail": "Choose the TikTok profile that will appear as the ad identity.",
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
          "label": "TikTok Account",
          "value": "Check after advertiser selection"
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
          "title": "Payment readiness is checked before publish",
          "detail": "If billing needs attention, the app should guide the advertiser before anything goes live.",
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
    "label": "Review",
    "state": {
      "screen": "draft",
      "phaseLabel": "Review",
      "headline": "Review before launch.",
      "summary": "Check the video, budget, destination, and report plan. We’ll publish only after you confirm.",
      "primaryCta": "Approve launch settings",
      "secondaryCta": "Edit campaign details",
      "timeline": [
        {
          "id": "product",
          "label": "Product",
          "status": "done",
          "owner": "user"
        },
        {
          "id": "creative",
          "label": "Storyboard",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "render",
          "label": "Preview",
          "status": "done",
          "owner": "chatgpt"
        },
        {
          "id": "accounts",
          "label": "Account setup",
          "status": "done",
          "owner": "tiktok"
        },
        {
          "id": "publish",
          "label": "Review",
          "status": "current",
          "owner": "user"
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
        "name": "Coach Brooklyn Bag | Smart+ | US",
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
            "value": "$50",
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
          "If billing needs attention, we’ll guide you to finish it before publish.",
          "Nothing goes live until you approve the final launch settings."
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
          "title": "Payment readiness is checked before publish",
          "detail": "If billing needs attention, the app should guide the advertiser before anything goes live.",
          "status": "gap"
        }
      ],
      "product": {
        "title": "Coach Brooklyn Shoulder Bag 28",
        "price": "$295",
        "destination": "https://coach.com/products/brooklyn-shoulder-bag-28",
        "platform": "Direct product URL",
        "creativeBriefFormat": "12s vertical video",
        "creativeBriefHook": "One bag, three easy outfits.",
        "creativeBriefObjective": "Shop the Brooklyn Bag",
        "creativeBriefTitle": "Everyday style switch",
        "imageCount": 3
      }
    }
  }
];
