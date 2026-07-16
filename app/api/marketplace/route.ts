import { NextResponse } from "next/server"
import {
  MarketplaceService,
  MarketplaceListing as ServiceListing,
} from "@/lib/services/marketplace-service"
import { withAuth, withRole } from "@/lib/auth/rbac"

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Initialize marketplace service with environment configs
const marketplaceConfigs = [
  {
    platform: "gumtree",
    enabled: true,
    credentials: process.env.GUMTREE_USERNAME
      ? {
          username: process.env.GUMTREE_USERNAME,
          password: process.env.GUMTREE_PASSWORD,
        }
      : undefined,
  },
  {
    platform: "facebook",
    enabled: !!process.env.FACEBOOK_ACCESS_TOKEN,
    credentials: process.env.FACEBOOK_ACCESS_TOKEN
      ? {
          accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
        }
      : undefined,
    settings: {
      pageId: process.env.FACEBOOK_PAGE_ID,
    },
  },
  {
    platform: "olx",
    enabled: true,
  },
  {
    platform: "bidorbuy",
    enabled: !!process.env.BIDORBUY_API_KEY,
    credentials: process.env.BIDORBUY_API_KEY
      ? {
          apiKey: process.env.BIDORBUY_API_KEY,
        }
      : undefined,
  },
  {
    platform: "autotrader",
    enabled: !!process.env.AUTOTRADER_DEALER_ID,
    credentials: process.env.AUTOTRADER_API_KEY
      ? {
          apiKey: process.env.AUTOTRADER_API_KEY,
        }
      : undefined,
    settings: {
      dealerId: process.env.AUTOTRADER_DEALER_ID,
    },
  },
]

const marketplaceService = new MarketplaceService(marketplaceConfigs)

// Marketplace platforms (for UI display)
const MARKETPLACE_PLATFORMS = {
  gumtree: {
    name: "Gumtree",
    url: "https://www.gumtree.co.za",
    postUrl: "https://www.gumtree.co.za/post",
    icon: "🟢",
    categories: ["vehicles", "electronics", "furniture", "tools"],
    hasApi: false,
  },
  facebook: {
    name: "Facebook Marketplace",
    url: "https://www.facebook.com/marketplace",
    postUrl: "https://www.facebook.com/marketplace/create",
    icon: "🔵",
    categories: ["all"],
    hasApi: true,
    configured: !!process.env.FACEBOOK_ACCESS_TOKEN,
  },
  olx: {
    name: "OLX",
    url: "https://www.olx.co.za",
    postUrl: "https://www.olx.co.za/post",
    icon: "🟡",
    categories: ["vehicles", "electronics", "furniture"],
    hasApi: false,
  },
  bidorbuy: {
    name: "BidOrBuy",
    url: "https://www.bidorbuy.co.za",
    postUrl: "https://www.bidorbuy.co.za/jsp/tradesimple/User2SellerSingleItem.jsp",
    icon: "🔴",
    categories: ["all"],
    supportsAuction: true,
    hasApi: true,
    configured: !!process.env.BIDORBUY_API_KEY,
  },
  autotrader: {
    name: "AutoTrader",
    url: "https://www.autotrader.co.za",
    postUrl: "https://www.autotrader.co.za/sell",
    icon: "🚗",
    categories: ["vehicles"],
    hasApi: true,
    configured: !!process.env.AUTOTRADER_DEALER_ID,
  },
}

// Listing interface
interface MarketplaceListing {
  id: string
  assetId: string
  assetName: string
  platform: string
  listingType: "fixed_price" | "auction" | "best_offer"
  price: number
  reservePrice?: number
  title: string
  description: string
  photos: string[]
  category: string
  condition: string
  location: string
  contactPhone: string
  contactEmail: string
  status: "draft" | "pending" | "active" | "sold" | "expired" | "cancelled"
  listingUrl?: string
  externalListingId?: string
  manualInstructions?: string
  views?: number
  inquiries?: number
  createdAt: string
  expiresAt?: string
}

const DEMO_LISTINGS: MarketplaceListing[] = [
  {
    id: "listing_001",
    assetId: "asset_003",
    assetName: "Bosch GWS 22-230 Angle Grinder",
    platform: "gumtree",
    listingType: "fixed_price",
    price: 650,
    title: "Bosch 230mm Angle Grinder - Good Condition",
    description:
      "Bosch GWS 22-230 angle grinder, 2200W. Well maintained, works perfectly. New brushes fitted Aug 2025. Selling due to upgrade.",
    photos: ["/assets/grinder-1.jpg"],
    category: "tools",
    condition: "fair",
    location: "Stellenbosch",
    contactPhone: "+27711488390",
    contactEmail: "sales@houseofv.com",
    status: "active",
    listingUrl: "https://gumtree.co.za/a-123456",
    views: 45,
    inquiries: 3,
    createdAt: "2026-02-15T10:00:00Z",
    expiresAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "listing_002",
    assetId: "asset_005",
    assetName: "Weber Genesis II E-410",
    platform: "gumtree",
    listingType: "fixed_price",
    price: 15000,
    title: "Weber Genesis II 4-Burner Gas Braai - Excellent Condition",
    description:
      "Premium Weber Genesis II E-410 gas braai. 4 burners, stainless steel. Regularly cleaned and maintained. Cover included. Ideal for entertaining.",
    photos: ["/assets/braai-1.jpg"],
    category: "outdoor",
    condition: "good",
    location: "Stellenbosch",
    contactPhone: "+27711488390",
    contactEmail: "sales@houseofv.com",
    status: "active",
    listingUrl: "https://gumtree.co.za/a-789012",
    views: 128,
    inquiries: 7,
    createdAt: "2026-02-10T10:00:00Z",
    expiresAt: "2026-03-10T10:00:00Z",
  },
]

// In-memory listings store
let listings: MarketplaceListing[] = DEMO_DATA_ENABLED ? [...DEMO_LISTINGS] : []

// GET - List marketplace listings or get platforms
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const platform = searchParams.get("platform")
  const status = searchParams.get("status")
  const assetId = searchParams.get("assetId")

  // Get available platforms
  if (action === "platforms") {
    return NextResponse.json({
      platforms: MARKETPLACE_PLATFORMS,
    })
  }

  // Filter listings
  let filteredListings = [...listings]

  if (platform) {
    filteredListings = filteredListings.filter((l) => l.platform === platform)
  }
  if (status) {
    filteredListings = filteredListings.filter((l) => l.status === status)
  }
  if (assetId) {
    filteredListings = filteredListings.filter((l) => l.assetId === assetId)
  }

  // Summary
  const summary = {
    total: filteredListings.length,
    active: filteredListings.filter((l) => l.status === "active").length,
    totalViews: filteredListings.reduce((sum, l) => sum + (l.views || 0), 0),
    totalInquiries: filteredListings.reduce((sum, l) => sum + (l.inquiries || 0), 0),
    potentialRevenue: filteredListings
      .filter((l) => l.status === "active")
      .reduce((sum, l) => sum + l.price, 0),
  }

  return NextResponse.json({
    listings: filteredListings,
    summary,
  })
})

// POST - Create listing or auto-publish
export const POST = withRole("admin")(async (request) => {
  try {
    const body = await request.json()
    const { action } = body

    // Generate listing content using AI (mock)
    if (action === "generate-listing") {
      const { assetId, assetName, category, condition, brand, model, price, description } = body

      // In production: Use Azure AI to generate optimized listing
      const generatedListing = {
        title: `${brand ? brand + " " : ""}${model || assetName} - ${condition.charAt(0).toUpperCase() + condition.slice(1)} Condition`,
        description: `${description}\n\nKey Features:\n• Brand: ${brand || "N/A"}\n• Model: ${model || "N/A"}\n• Condition: ${condition}\n• Location: Stellenbosch, Western Cape\n\nSerious buyers only. Price negotiable for quick sale.\n\nContact via Gumtree or call/WhatsApp.`,
        suggestedPrice: price,
        suggestedPlatforms: Object.entries(MARKETPLACE_PLATFORMS)
          .filter(([_, p]) => p.categories.includes("all") || p.categories.includes(category))
          .map(([key, p]) => ({ id: key, name: p.name, icon: p.icon })),
        keywords: [brand, model, category, condition].filter(Boolean),
      }

      return NextResponse.json({
        success: true,
        generated: generatedListing,
      })
    }

    // Auto-publish to multiple platforms using real marketplace service
    if (action === "auto-publish") {
      const {
        assetId,
        assetName,
        platforms,
        title,
        description,
        price,
        photos,
        category,
        condition,
        location,
      } = body

      // Prepare listing data for the marketplace service
      const listingData: ServiceListing = {
        title,
        description,
        price,
        currency: "ZAR",
        category,
        condition,
        location: {
          city: location || "Stellenbosch",
          province: "Western Cape",
        },
        images: photos || [],
        contactName: "House of Veritas",
        contactPhone: "+27711488390",
        contactEmail: "sales@houseofv.com",
      }

      // Publish to all selected platforms
      const publishResults = await marketplaceService.publishToMultiplePlatforms(
        listingData,
        platforms
      )

      // Create local listings for tracking
      const newListings: MarketplaceListing[] = []

      for (const result of publishResults) {
        const platformKey = result.platform
        const platform = MARKETPLACE_PLATFORMS[platformKey as keyof typeof MARKETPLACE_PLATFORMS]

        if (!platform) continue

        const listing: MarketplaceListing = {
          id: `listing_${Date.now()}_${platformKey}`,
          assetId,
          assetName,
          platform: platformKey,
          listingType: "fixed_price",
          price,
          title,
          description,
          photos: photos || [],
          category,
          condition,
          location: location || "Stellenbosch",
          contactPhone: "+27711488390",
          contactEmail: "sales@houseofv.com",
          status: result.requiresManualAction ? "pending" : result.success ? "active" : "draft",
          listingUrl: result.listingUrl,
          externalListingId: result.listingId,
          manualInstructions: result.manualInstructions,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }

        listings.push(listing)
        newListings.push(listing)
      }

      return NextResponse.json({
        success: true,
        listings: newListings,
        publishResults,
        platformsInfo: marketplaceService.getSupportedPlatforms(),
        note: publishResults.some((r) => r.requiresManualAction)
          ? "Some listings require manual completion. See instructions for each platform."
          : "All listings published successfully.",
      })
    }

    // Legacy auto-publish (backwards compatibility)
    if (action === "auto-publish-legacy") {
      const {
        assetId,
        assetName,
        platforms,
        title,
        description,
        price,
        photos,
        category,
        condition,
        location,
      } = body

      const newListings: MarketplaceListing[] = []
      const publishResults: Array<{
        platform: string
        success: boolean
        url?: string
        error?: string
      }> = []

      for (const platformKey of platforms) {
        const platform = MARKETPLACE_PLATFORMS[platformKey as keyof typeof MARKETPLACE_PLATFORMS]
        if (!platform) continue

        // In production: Actually post to marketplace APIs
        // For now, create local listings with post URLs
        const listing: MarketplaceListing = {
          id: `listing_${Date.now()}_${platformKey}`,
          assetId,
          assetName,
          platform: platformKey,
          listingType: "fixed_price",
          price,
          title,
          description,
          photos: photos || [],
          category,
          condition,
          location: location || "Stellenbosch",
          contactPhone: "+27711488390",
          contactEmail: "sales@houseofv.com",
          status: "draft", // Would be 'active' after actual posting
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }

        listings.push(listing)
        newListings.push(listing)

        publishResults.push({
          platform: platformKey,
          success: true,
          url: platform.postUrl,
        })
      }

      return NextResponse.json({
        success: true,
        listings: newListings,
        publishResults,
        note: "Listings created as drafts. Visit each platform to complete posting.",
      })
    }

    // Create single listing
    const {
      assetId,
      assetName,
      platform,
      listingType = "fixed_price",
      price,
      title,
      description,
      photos,
      category,
      condition,
      location,
    } = body

    if (!assetId || !platform || !price || !title) {
      return NextResponse.json(
        { error: "assetId, platform, price, and title are required" },
        { status: 400 }
      )
    }

    const newListing: MarketplaceListing = {
      id: `listing_${Date.now()}`,
      assetId,
      assetName: assetName || "",
      platform,
      listingType,
      price,
      title,
      description: description || "",
      photos: photos || [],
      category: category || "other",
      condition: condition || "good",
      location: location || "Stellenbosch",
      contactPhone: "+27711488390",
      contactEmail: "sales@houseofv.com",
      status: "draft",
      createdAt: new Date().toISOString(),
    }

    listings.push(newListing)

    return NextResponse.json({
      success: true,
      listing: newListing,
      postUrl: MARKETPLACE_PLATFORMS[platform as keyof typeof MARKETPLACE_PLATFORMS]?.postUrl,
    })
  } catch (error) {
    return NextResponse.json({ error: "Operation failed" }, { status: 500 })
  }
})

// PUT - Update listing status
export const PUT = withRole("admin")(async (request) => {
  try {
    const body = await request.json()
    const { id, status, views, inquiries, listingUrl } = body

    if (!id) {
      return NextResponse.json({ error: "Listing ID required" }, { status: 400 })
    }

    const index = listings.findIndex((l) => l.id === id)
    if (index === -1) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    if (status) listings[index].status = status
    if (views !== undefined) listings[index].views = views
    if (inquiries !== undefined) listings[index].inquiries = inquiries
    if (listingUrl) listings[index].listingUrl = listingUrl

    return NextResponse.json({
      success: true,
      listing: listings[index],
    })
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
})
