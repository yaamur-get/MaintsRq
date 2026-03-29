# Request Data API Endpoint

## Overview
Get request data by `rq_number` to display basic information for inspection report creation.

## Endpoint

### GET /api/requests/{rq_number}

Fetches request details with related mosque, district, and city information.

---

## Request

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rq_number` | string | Yes | The unique request number identifier |

### Example
```bash
GET /api/requests/RQ-123456
```

---

## Response

### Success (200 OK)
Returns the request data with related information:

```json
{
  "mosque_name": "مسجد الهدى",
  "applicant_name": "أبو محمد",
  "phone": "0512345678",
  "district": "الفيصلية",
  "city": "الدمام"
}
```

### Error Responses

#### Request Not Found (404)
```json
{
  "error": "Not found"
}
```

#### Missing rq_number (400)
```json
{
  "error": "rq_number is required"
}
```

#### Method Not Allowed (405)
```json
{
  "error": "Method Not Allowed"
}
```

#### Server Error (500)
```json
{
  "error": "Internal server error"
}
```

---

## Usage Example (JavaScript/Fetch API)

```javascript
async function getRequestData(rqNumber) {
  try {
    const response = await fetch(`/api/requests/${rqNumber}`);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error.error);
      return null;
    }
    
    const data = await response.json();
    console.log('Request Data:', data);
    return data;
  } catch (error) {
    console.error('Fetch Error:', error);
    return null;
  }
}

// Usage
const requestData = await getRequestData('RQ-123456');
if (requestData) {
  // Populate form fields
  document.getElementById('mosque_name').value = requestData.mosque_name || '';
  document.getElementById('applicant_name').value = requestData.applicant_name || '';
  document.getElementById('phone').value = requestData.phone || '';
  document.getElementById('district').value = requestData.district || '';
  document.getElementById('city').value = requestData.city || '';
}
```

---

## Usage Example (React Hook)

```typescript
import { useState, useEffect } from 'react';

interface RequestData {
  mosque_name?: string;
  applicant_name?: string;
  phone?: string;
  district?: string;
  city?: string;
  error?: string;
}

export function useRequestData(rqNumber: string | null) {
  const [data, setData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rqNumber) {
      setData(null);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/requests/${rqNumber}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error);
          setData(null);
          return;
        }
        
        const requestData = await response.json();
        setData(requestData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [rqNumber]);

  return { data, loading, error };
}

// Usage in component
export function InspectionForm() {
  const [rqNumber, setRqNumber] = useState('');
  const { data: requestData, loading, error } = useRequestData(rqNumber);

  return (
    <div>
      <input
        value={rqNumber}
        onChange={(e) => setRqNumber(e.target.value)}
        placeholder="Enter RQ Number"
      />
      
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      
      {requestData && (
        <div>
          <input value={requestData.mosque_name || ''} readOnly />
          <input value={requestData.applicant_name || ''} readOnly />
          <input value={requestData.phone || ''} readOnly />
          <input value={requestData.district || ''} readOnly />
          <input value={requestData.city || ''} readOnly />
        </div>
      )}
    </div>
  );
}
```

---

## Data Source

The endpoint joins data from multiple tables:

- **requests** table:
  - `beneficiary_name` → `applicant_name`
  - `beneficiary_phone` → `phone`
  - `mosque_id` (for joining)

- **mosques** table (via `mosque_id`):
  - `name` → `mosque_name`
  - `district_id` (for joining)

- **districts** table (via `district_id`):
  - `name` → `district`
  - `city_id` (for joining)

- **cities** table (via `city_id`):
  - `name` → `city`

---

## Security Notes

- ✅ Uses `service_role` key for backend operations only
- ✅ Bypasses RLS policies safely (read-only operation)
- ✅ No data modification possible
- ⚠️ Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code

---

## Setup Instructions

1. Get the `service_role` key from Supabase:
   - Go to Supabase Dashboard → Project Settings → API
   - Copy the "Service Role Secret" key

2. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. Restart the development server:
   ```bash
   npm run dev
   ```

4. Test the endpoint:
   ```bash
   curl "http://localhost:3000/api/requests/RQ-123456"
   ```

---

## Deployment

When deploying to production (Vercel, etc.):

1. Add environment variable in deployment platform:
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key

2. The endpoint will be available at:
   ```
   https://your-domain.com/api/requests/{rq_number}
   ```
