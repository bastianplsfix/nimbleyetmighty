# =========================
# Basic requests
# =========================
GET http://localhost:8000/
GET http://localhost:8000/health
GET http://localhost:8000/json


# =========================
# Path parameters
# =========================
GET http://localhost:8000/users/42
GET http://localhost:8000/users/1/posts/99


# =========================
# Query parameters
# =========================
GET http://localhost:8000/search?q=nimble&page=2&limit=20


# =========================
# POST with body
# =========================
POST http://localhost:8000/echo
`Hello!`

POST http://localhost:8000/users
Content-Type: application/json
{
  "name": "Alice"
}


# =========================
# Cookies
# =========================
POST http://localhost:8000/login
HTTP *

GET http://localhost:8000/me
HTTP *

# =========================
# Request ID / Tracing
# =========================
GET http://localhost:8000/trace

GET http://localhost:8000/trace
x-request-id: my-custom-id

GET http://localhost:8000/trace
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01


# =========================
# Wildcard method
# =========================
GET http://localhost:8000/wildcard
POST http://localhost:8000/wildcard
DELETE http://localhost:8000/wildcard


# =========================
# Wildcard path
# =========================
GET http://localhost:8000/files/images/photo.jpg


# =========================
# Custom methods
# =========================
PROPFIND http://localhost:8000/webdav
PURGE http://localhost:8000/cache


# =========================
# Headers
# =========================
GET http://localhost:8000/headers
GET http://localhost:8000/user-agent


# =========================
# Streaming
# =========================
GET http://localhost:8000/stream
