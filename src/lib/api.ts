import type {
  DashboardStats, Agent, Task, ContentItem, PaginatedResponse,
  Deal, Contact, DealActivity, Subscriber, EmailCampaign,
  Competitor, CompetitorPost, PipelineStage,
  Influencer, Collaboration, DesignSystem,
  Plan, Subscription, Usage, PlanId,
} from "@/lib/types"
import type { AgentWithTaskCount, AgentDetail } from "@/lib/queries/agents"
import type { AnalyticsData } from "@/lib/queries/analytics"

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  const json = await res.json()
  return json.data !== undefined ? json.data : json
}

export const api = {
  stats: {
    get: (params?: Record<string, string>) => {
      const qs = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : ""
      return apiCall<DashboardStats>(`/stats${qs}`)
    },
  },
  agents: {
    list: () => apiCall<AgentWithTaskCount[]>("/agents"),
    get: (slug: string) => apiCall<AgentDetail>(`/agents/${slug}`),
  },
  content: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<PaginatedResponse<ContentItem>>(`/content${qs}`)
    },
    get: (id: string) => apiCall<ContentItem>(`/content/${id}`),
    update: (id: string, data: Partial<ContentItem>) =>
      apiCall<ContentItem>(`/content/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },
  crm: {
    pipeline: () => apiCall<{ stages: Array<PipelineStage & { deals: Array<Deal & { contact_name: string | null }> }> }>("/crm/pipeline"),
    updateDeal: (id: string, data: Partial<Deal>) =>
      apiCall<Deal>(`/crm/deals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    createDeal: (data: Partial<Deal>) =>
      apiCall<Deal>("/crm/deals", { method: "POST", body: JSON.stringify(data) }),
    contacts: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<PaginatedResponse<Contact>>(`/crm/contacts${qs}`)
    },
    contact: (id: string) => apiCall<{ contact: Contact, activities: DealActivity[] }>(`/crm/contacts/${id}`),
  },
  email: {
    subscribers: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<PaginatedResponse<Subscriber> & { stats: Record<string, number> }>(`/email/subscribers${qs}`)
    },
    campaigns: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<PaginatedResponse<EmailCampaign>>(`/email/campaigns${qs}`)
    },
    campaign: (id: string) => apiCall<EmailCampaign>(`/email/campaigns/${id}`),
  },
  competitors: {
    list: () => apiCall<Competitor[]>("/competitors"),
    get: (id: string, params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<{ competitor: Competitor, posts: CompetitorPost[], total: number }>(`/competitors/${id}${qs}`)
    },
  },
  influencers: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<PaginatedResponse<Influencer & { collaboration_count: number }>>(`/influencers${qs}`)
    },
    get: (id: string) => apiCall<{ influencer: Influencer, collaborations: Collaboration[] }>(`/influencers/${id}`),
  },
  designSystem: {
    get: () => apiCall<DesignSystem>("/design-system"),
    update: (data: Partial<DesignSystem>) =>
      apiCall<DesignSystem>("/design-system", { method: "PATCH", body: JSON.stringify(data) }),
  },
  settings: {
    get: () => apiCall<Record<string, unknown>>("/settings"),
    update: (data: Record<string, unknown>) =>
      apiCall<Record<string, unknown>>("/settings", { method: "PATCH", body: JSON.stringify(data) }),
  },
  credentials: {
    list: () => apiCall<Array<{ service: string; keys: string[] }>>("/credentials"),
    save: (service: string, key: string, value: string) =>
      apiCall("/credentials", { method: "POST", body: JSON.stringify({ service, key, value }) }),
    deleteService: (service: string) =>
      apiCall(`/credentials/${service}`, { method: "DELETE" }),
    test: (service: string) =>
      apiCall<{ ok: boolean; message: string }>("/credentials/test", {
        method: "POST",
        body: JSON.stringify({ service }),
      }),
  },
  billing: {
    plans: () => apiCall<{ data: Plan[] }>("/billing/plans"),
    subscription: () =>
      apiCall<{ data: { subscription: Subscription | null; usage: Usage | null; currentPlan: string } }>("/billing/subscription"),
    subscribe: (planId: PlanId, billingCycle: string = "monthly") =>
      apiCall<{ data: Subscription }>("/billing/subscription", {
        method: "POST",
        body: JSON.stringify({ planId, billingCycle }),
      }),
    cancel: () => apiCall<{ data: Subscription }>("/billing/subscription", { method: "DELETE" }),
    usage: () => apiCall("/billing/usage"),
  },
  analytics: {
    get: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return apiCall<AnalyticsData>(`/analytics${qs}`)
    },
  },
}
