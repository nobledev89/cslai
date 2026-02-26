# TrackPod Integration

A read-only integration for TrackPod API that provides access to orders, routes, and vehicles.

## Features

### ✅ Read-Only Operations
This integration **only performs GET requests** and makes no modifications to TrackPod data.

### 📦 Order Management
- Get order by number, ID, or TrackId
- Get orders by date, route date, or route code
- Get orders by status modification date
- Get orders by number list (up to 25)

### 🚚 Route Management
- Get route by code or ID
- Get routes by date
- Get route tracking information
- Get routes for export (not yet exported)

### 🚗 Vehicle Management
- Get all vehicles
- Get vehicle by ID
- Get vehicle checks by number and/or date

### 🔔 Webhook Support
Supports webhook events for:
- `route.created`, `route.updated`, `route.deleted`
- `order.created`, `order.updated`, `order.deleted`

## Configuration

```typescript
{
  apiKey: string;           // Required: X-API-KEY header value
  baseUrl: string;          // Default: 'https://api.track-pod.com'
  maxResults: number;       // Default: 20 (1-100)
  timeoutMs: number;        // Default: 10000 (1000-30000)
  enabled: boolean;         // Default: true
}
```

## API Reference

### Orders (Read-Only)

All order endpoints use GET requests only:

```typescript
// Get single order
await integration.getOrderByNumber('ORD-123');
await integration.getOrderById('order-id-123');
await integration.getOrderByTrackId('track-123');

// Get multiple orders
await integration.getOrdersByDate('2026-02-26');
await integration.getOrdersByRouteDate('2026-02-26');
await integration.getOrdersByRouteCode('ROUTE-001');
await integration.getOrdersByStatusDate('2026-02-26T08:00:00');
await integration.getOrdersByNumberList(['ORD-1', 'ORD-2', 'ORD-3']);
```

### Routes (Read-Only)

All route endpoints use GET requests only:

```typescript
// Get single route
await integration.getRouteByCode('ROUTE-001');
await integration.getRouteById('route-id-123');

// Get multiple routes
await integration.getRoutesByDate('2026-02-26');
await integration.getRouteCodesForExport();
await integration.getRouteIdsForExport();

// Get route tracking
await integration.getRouteTrackByCode('ROUTE-001');
await integration.getRouteTrackById('route-id-123');
```

### Vehicles (Read-Only)

All vehicle endpoints use GET requests only:

```typescript
// Get vehicles
await integration.getVehicles();
await integration.getVehicleById('vehicle-id-123');

// Get vehicle checks
await integration.getVehicleCheckByNumber('CHECK-001');
await integration.getVehicleChecksByDate('2026-02-26');
await integration.getVehicleChecksByNumberAndDate('CHECK-001', '2026-02-26');
```

### Webhooks

```typescript
// Handle incoming webhook
const result = await integration.handleWebhook('order.created', payload);
// Returns: { success: boolean, message: string, data?: any }
```

## API Endpoints Mapping

### Orders (GET Only)
- `GET /Order/Number/{number}` - Get order by number
- `GET /Order/Id/{id}` - Get order by ID
- `GET /Order/TrackId/{trackId}` - Get order by TrackId
- `GET /Order/Date/{date}` - Get orders by date
- `GET /Order/Route/Date/{date}` - Get orders by route date
- `GET /Order/Route/Code/{code}` - Get orders by route code
- `GET /Order/Status/Date/{date}` - Get orders after status modify date
- `GET /Order/Number/{number}/List` - Get orders by number list

### Routes (GET Only)
- `GET /Route/Code/{code}` - Get route by code
- `GET /Route/Id/{id}` - Get route by ID
- `GET /Route/Date/{date}` - Get routes by date
- `GET /Route/Export/Code` - Get route codes for export
- `GET /Route/Export/Id` - Get route IDs for export
- `GET /Route/Track/Code/{code}` - Get route track by code
- `GET /Route/Track/Id/{id}` - Get route track by ID

### Vehicles (GET Only)
- `GET /Vehicle` - Get all vehicles
- `GET /Vehicle/{id}` - Get vehicle by ID
- `GET /VehicleCheck/{number}` - Get last vehicle check by number
- `GET /VehicleCheck/Date/{date}` - Get vehicle checks by date
- `GET /VehicleCheck/Number/{number}/Date/{date}` - Get vehicle checks by number and date

## Request Headers

All requests include:
```
X-API-KEY: <your-api-key>
Accept: application/json
Accept-Encoding: gzip, deflate, br
Content-Type: application/json
```

## Error Handling

- **401/403**: Authentication failed - check API key
- **404**: Resource not found - returns `null`
- **Other errors**: Throws error with status and message

## Security Notes

### ⚠️ Read-Only by Design
- **No POST** requests (creating data)
- **No PUT** requests (updating data)
- **No DELETE** requests (deleting data)
- **No PATCH** requests (partial updates)

This ensures that the integration can only **read** data from TrackPod and cannot modify orders, routes, or any other resources.

## Usage Example

```typescript
import { TrackpodIntegration } from './trackpod.integration';

const config = {
  apiKey: 'your-api-key',
  baseUrl: 'https://api.track-pod.com',
  maxResults: 20,
  timeoutMs: 10000,
  enabled: true,
};

const integration = new TrackpodIntegration(config);

// Test connection
await integration.testConnection();

// Search for data (enrichment)
const result = await integration.runEnrichment('ORD-123');

// Get specific order
const order = await integration.getOrderByNumber('ORD-123');

// Get routes for today
const today = new Date().toISOString().split('T')[0];
const routes = await integration.getRoutesByDate(today);
```

## Webhook Integration

Configure your TrackPod webhooks to point to your endpoint, then handle events:

```typescript
app.post('/webhooks/trackpod', async (req, res) => {
  const { event, payload } = req.body;
  const result = await integration.handleWebhook(event, payload);
  res.json(result);
});
```

## Date Format

All date parameters use `YYYY-MM-DD` format (e.g., `2026-02-26`).

Datetime parameters use ISO 8601 format (e.g., `2026-02-26T08:00:00`).

## Rate Limiting

Respect TrackPod's rate limits. The integration includes:
- Configurable timeout (default: 10s)
- Automatic error handling
- Connection pooling via native fetch

## Testing

```bash
# Build the shared package
pnpm --filter @company-intel/shared build

# Build the API
pnpm --filter api build

# Run tests
pnpm --filter api test
```

## Support

For TrackPod API documentation, visit: https://api.track-pod.com/
