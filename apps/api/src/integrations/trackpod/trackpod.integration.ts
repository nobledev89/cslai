import { IIntegration } from '../integration.interface';
import { NormalizedResult, TrackpodConfig, okResult, errResult } from '@company-intel/shared';

/**
 * TrackPod Integration — Read-Only Implementation
 * 
 * This integration provides read-only access to TrackPod orders, routes, and vehicles.
 * No write operations (POST, PUT, DELETE, PATCH) are implemented to ensure data integrity.
 * 
 * API Documentation: https://api.track-pod.com/
 * 
 * Features:
 * - Order retrieval (by number, id, date, route, status)
 * - Route retrieval (by code, id, date, tracking)
 * - Vehicle and vehicle check retrieval
 * - Webhook support for real-time updates
 */
export class TrackpodIntegration implements IIntegration {
  constructor(private readonly config: TrackpodConfig) {}

  /**
   * Standard request headers for TrackPod API
   */
  private get authHeaders() {
    return {
      'X-API-KEY': this.config.apiKey,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get timeout with safe default
   */
  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 10000;
  }

  /**
   * Get max results with safe default
   */
  private get maxResults(): number {
    return this.config.maxResults ?? 20;
  }

  /**
   * Get base URL with safe default
   */
  private get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.track-pod.com';
  }

  /**
   * Check if integration is enabled (default to true if not specified)
   */
  private get isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Test connection by fetching vehicles (lightweight endpoint)
   */
  async testConnection(): Promise<void> {
    if (!this.isEnabled) {
      throw new Error('TrackPod integration is disabled');
    }

    const url = `${this.baseUrl}/Vehicle`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('TrackPod authentication failed. Please check your API key.');
    }

    if (!res.ok) {
      throw new Error(`TrackPod test failed: ${res.status} ${res.statusText}`);
    }
  }

  /**
   * Run enrichment by searching orders and routes based on the query
   */
  async runEnrichment(query: string): Promise<NormalizedResult> {
    const startTime = Date.now();

    if (!this.isEnabled) {
      return okResult('TRACKPOD', []);
    }

    try {
      // Search for orders by number or route code
      const results = await Promise.allSettled([
        this.searchOrdersByNumber(query),
        this.searchRoutesByCode(query),
      ]);

      const durationMs = Date.now() - startTime;

      const items: Array<{
        label: string;
        summary: string;
        data: Record<string, unknown>;
        timestamp?: string;
      }> = [];

      // Process order results
      if (results[0].status === 'fulfilled') {
        items.push(...results[0].value);
      }

      // Process route results
      if (results[1].status === 'fulfilled') {
        items.push(...results[1].value);
      }

      // Limit results to maxResults
      const limitedItems = items.slice(0, this.maxResults);

      return okResult('TRACKPOD', limitedItems, { durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return errResult('TRACKPOD', err?.message ?? 'Unknown TrackPod error', { durationMs });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER METHODS (Read-Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get order by number
   * GET /Order/Number/{number}
   */
  async getOrderByNumber(orderNumber: string): Promise<any> {
    const url = `${this.baseUrl}/Order/Number/${encodeURIComponent(orderNumber)}`;
    return this.makeRequest(url);
  }

  /**
   * Get order by ID
   * GET /Order/Id/{id}
   */
  async getOrderById(orderId: string): Promise<any> {
    const url = `${this.baseUrl}/Order/Id/${encodeURIComponent(orderId)}`;
    return this.makeRequest(url);
  }

  /**
   * Get order by TrackId
   * GET /Order/TrackId/{trackId}
   */
  async getOrderByTrackId(trackId: string): Promise<any> {
    const url = `${this.baseUrl}/Order/TrackId/${encodeURIComponent(trackId)}`;
    return this.makeRequest(url);
  }

  /**
   * Get orders by date
   * GET /Order/Date/{date}
   * @param date - Format: YYYY-MM-DD
   */
  async getOrdersByDate(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/Order/Date/${date}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get orders by route date
   * GET /Order/Route/Date/{date}
   * @param date - Format: YYYY-MM-DD
   */
  async getOrdersByRouteDate(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/Order/Route/Date/${date}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get orders by route code
   * GET /Order/Route/Code/{code}
   */
  async getOrdersByRouteCode(routeCode: string): Promise<any[]> {
    const url = `${this.baseUrl}/Order/Route/Code/${encodeURIComponent(routeCode)}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get orders after status modify date and time
   * GET /Order/Status/Date/{date}
   * @param date - Format: YYYY-MM-DDTHH:mm:ss (min. request time is UTC - 1 day)
   */
  async getOrdersByStatusDate(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/Order/Status/Date/${encodeURIComponent(date)}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get orders by number list
   * GET /Order/Number/{number}/List
   * @param numbers - Comma-separated list of order numbers (last 25 orders)
   */
  async getOrdersByNumberList(numbers: string[]): Promise<any[]> {
    const numberList = numbers.slice(0, 25).join(',');
    const url = `${this.baseUrl}/Order/Number/${encodeURIComponent(numberList)}/List`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE METHODS (Read-Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get route by code
   * GET /Route/Code/{code}
   */
  async getRouteByCode(routeCode: string): Promise<any> {
    const url = `${this.baseUrl}/Route/Code/${encodeURIComponent(routeCode)}`;
    return this.makeRequest(url);
  }

  /**
   * Get route by ID
   * GET /Route/Id/{id}
   */
  async getRouteById(routeId: string): Promise<any> {
    const url = `${this.baseUrl}/Route/Id/${encodeURIComponent(routeId)}`;
    return this.makeRequest(url);
  }

  /**
   * Get routes by date
   * GET /Route/Date/{date}
   * @param date - Format: YYYY-MM-DD
   */
  async getRoutesByDate(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/Route/Date/${date}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get route codes for export (exported is False)
   * GET /Route/Export/Code
   */
  async getRouteCodesForExport(): Promise<any[]> {
    const url = `${this.baseUrl}/Route/Export/Code`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get route IDs for export (exported is False)
   * GET /Route/Export/Id
   */
  async getRouteIdsForExport(): Promise<any[]> {
    const url = `${this.baseUrl}/Route/Export/Id`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get route track by code
   * GET /Route/Track/Code/{code}
   */
  async getRouteTrackByCode(routeCode: string): Promise<any> {
    const url = `${this.baseUrl}/Route/Track/Code/${encodeURIComponent(routeCode)}`;
    return this.makeRequest(url);
  }

  /**
   * Get route track by ID
   * GET /Route/Track/Id/{id}
   */
  async getRouteTrackById(routeId: string): Promise<any> {
    const url = `${this.baseUrl}/Route/Track/Id/${encodeURIComponent(routeId)}`;
    return this.makeRequest(url);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE METHODS (Read-Only)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get vehicle by ID
   * GET /Vehicle/{id}
   */
  async getVehicleById(vehicleId: string): Promise<any> {
    const url = `${this.baseUrl}/Vehicle/${encodeURIComponent(vehicleId)}`;
    return this.makeRequest(url);
  }

  /**
   * Get all vehicles
   * GET /Vehicle
   */
  async getVehicles(): Promise<any[]> {
    const url = `${this.baseUrl}/Vehicle`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get last vehicle check by number
   * GET /VehicleCheck/{number}
   */
  async getVehicleCheckByNumber(checkNumber: string): Promise<any> {
    const url = `${this.baseUrl}/VehicleCheck/${encodeURIComponent(checkNumber)}`;
    return this.makeRequest(url);
  }

  /**
   * Get vehicle checks by date
   * GET /VehicleCheck/Date/{date}
   * @param date - Format: YYYY-MM-DD
   */
  async getVehicleChecksByDate(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/VehicleCheck/Date/${date}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get vehicle checks by number and date
   * GET /VehicleCheck/Number/{number}/Date/{date}
   * @param number - Vehicle check number
   * @param date - Format: YYYY-MM-DD
   */
  async getVehicleChecksByNumberAndDate(number: string, date: string): Promise<any[]> {
    const url = `${this.baseUrl}/VehicleCheck/Number/${encodeURIComponent(number)}/Date/${date}`;
    const result = await this.makeRequest(url);
    return Array.isArray(result) ? result : [result];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle webhook event from TrackPod
   * 
   * Supported webhook events:
   * - Create/Update/Delete route
   * - Create/Update/Delete order
   * 
   * @param event - The webhook event type
   * @param payload - The webhook payload
   */
  async handleWebhook(event: string, payload: any): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      switch (event) {
        case 'route.created':
        case 'route.updated':
          return {
            success: true,
            message: `Route ${event.split('.')[1]} webhook received`,
            data: { routeId: payload.id, routeCode: payload.code },
          };

        case 'route.deleted':
          return {
            success: true,
            message: 'Route deleted webhook received',
            data: { routeId: payload.id },
          };

        case 'order.created':
        case 'order.updated':
          return {
            success: true,
            message: `Order ${event.split('.')[1]} webhook received`,
            data: { orderId: payload.id, orderNumber: payload.number },
          };

        case 'order.deleted':
          return {
            success: true,
            message: 'Order deleted webhook received',
            data: { orderId: payload.id },
          };

        default:
          return {
            success: false,
            message: `Unknown webhook event: ${event}`,
          };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Webhook processing error: ${err.message}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Make a GET request to TrackPod API
   */
  private async makeRequest(url: string): Promise<any> {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('TrackPod authentication failed. Please check your API key.');
    }

    if (res.status === 404) {
      return null; // Resource not found
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`TrackPod API error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    return res.json();
  }

  /**
   * Search orders by number (for enrichment)
   */
  private async searchOrdersByNumber(query: string) {
    try {
      const order = await this.getOrderByNumber(query);
      if (!order) return [];

      return [
        {
          label: `Order #${order.number || order.orderNumber || query}`,
          summary: `Status: ${order.status || 'N/A'}, Route: ${order.routeCode || order.route?.code || 'N/A'}`,
          data: {
            orderId: order.id,
            orderNumber: order.number || order.orderNumber,
            status: order.status,
            routeCode: order.routeCode || order.route?.code,
            address: order.address,
            customerName: order.customerName || order.customer?.name,
          },
          timestamp: order.modifiedDate || order.createdDate,
        },
      ];
    } catch {
      return [];
    }
  }

  /**
   * Search routes by code (for enrichment)
   */
  private async searchRoutesByCode(query: string) {
    try {
      const route = await this.getRouteByCode(query);
      if (!route) return [];

      return [
        {
          label: `Route: ${route.code || query}`,
          summary: `Status: ${route.status || 'N/A'}, Driver: ${route.driver?.name || 'N/A'}, Orders: ${route.orderCount || route.orders?.length || 0}`,
          data: {
            routeId: route.id,
            routeCode: route.code,
            status: route.status,
            driverName: route.driver?.name,
            vehicleNumber: route.vehicle?.number,
            orderCount: route.orderCount || route.orders?.length,
            date: route.date,
          },
          timestamp: route.modifiedDate || route.createdDate || route.date,
        },
      ];
    } catch {
      return [];
    }
  }
}
