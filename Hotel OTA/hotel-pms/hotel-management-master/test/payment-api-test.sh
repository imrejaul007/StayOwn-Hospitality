#!/bin/bash

# Comprehensive Payment System API Testing Script
API_BASE="http://localhost:4000/api/v1"
HOTEL_ID="68bc094f80c86bfe258e172b"

# Test credentials
ADMIN_EMAIL="owner@grandpalacehotel.com"
ADMIN_PASSWORD="admin123"
STAFF_EMAIL="reception@grandpalacehotel.com"
STAFF_PASSWORD="staff123"
GUEST_EMAIL="alice.johnson@email.com"
GUEST_PASSWORD="guest123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name${NC}: $details"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name${NC}: $details"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Helper function to make API calls
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"

    local curl_cmd="curl -s -X $method \"$API_BASE$endpoint\""

    if [ -n "$token" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $token\""
    fi

    curl_cmd="$curl_cmd -H \"Content-Type: application/json\""

    if [ -n "$data" ] && [ "$method" != "GET" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi

    eval $curl_cmd
}

# Authentication setup
echo -e "${BLUE}🔐 Setting up authentication...${NC}"

# Login as admin
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if echo "$ADMIN_LOGIN_RESPONSE" | grep -q "token"; then
    ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log_test "Admin Authentication" "PASS" "Token obtained"
else
    log_test "Admin Authentication" "FAIL" "Failed to obtain admin token"
    echo "Response: $ADMIN_LOGIN_RESPONSE"
    exit 1
fi

# Login as staff
STAFF_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$STAFF_EMAIL\",\"password\":\"$STAFF_PASSWORD\"}")

if echo "$STAFF_LOGIN_RESPONSE" | grep -q "token"; then
    STAFF_TOKEN=$(echo "$STAFF_LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log_test "Staff Authentication" "PASS" "Token obtained"
else
    log_test "Staff Authentication" "FAIL" "Failed to obtain staff token"
fi

# Login as guest
GUEST_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$GUEST_EMAIL\",\"password\":\"$GUEST_PASSWORD\"}")

if echo "$GUEST_LOGIN_RESPONSE" | grep -q "token"; then
    GUEST_TOKEN=$(echo "$GUEST_LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log_test "Guest Authentication" "PASS" "Token obtained"
else
    log_test "Guest Authentication" "FAIL" "Failed to obtain guest token"
fi

echo ""

# Test Settlement API
echo -e "${BLUE}💰 Testing Settlement API...${NC}"

# Get existing bookings first
BOOKINGS_RESPONSE=$(curl -s -X GET "$API_BASE/bookings" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")

if echo "$BOOKINGS_RESPONSE" | grep -q "bookings"; then
    # Extract first booking ID
    BOOKING_ID=$(echo "$BOOKINGS_RESPONSE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_test "Get Bookings" "PASS" "Found booking: $BOOKING_ID"

    # Test Create Settlement
    CREATE_SETTLEMENT_RESPONSE=$(curl -s -X POST "$API_BASE/settlements" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"bookingId\":\"$BOOKING_ID\",
            \"dueDate\":\"$(date -d '+7 days' -I)\",
            \"notes\":\"Test settlement for E2E testing\"
        }")

    if echo "$CREATE_SETTLEMENT_RESPONSE" | grep -q '"status":"success"'; then
        SETTLEMENT_ID=$(echo "$CREATE_SETTLEMENT_RESPONSE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_test "Create Settlement" "PASS" "Settlement created: $SETTLEMENT_ID"

        # Test Get Settlement by ID
        GET_SETTLEMENT_RESPONSE=$(curl -s -X GET "$API_BASE/settlements/$SETTLEMENT_ID" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json")

        if echo "$GET_SETTLEMENT_RESPONSE" | grep -q "$SETTLEMENT_ID"; then
            log_test "Get Settlement by ID" "PASS" "Settlement retrieved successfully"
        else
            log_test "Get Settlement by ID" "FAIL" "Failed to retrieve settlement"
        fi

        # Test Add Payment to Settlement
        ADD_PAYMENT_RESPONSE=$(curl -s -X POST "$API_BASE/settlements/$SETTLEMENT_ID/payment" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"amount\":5000,
                \"method\":\"cash\",
                \"reference\":\"TEST-PAYMENT-001\",
                \"notes\":\"Test payment for E2E testing\"
            }")

        if echo "$ADD_PAYMENT_RESPONSE" | grep -q '"status":"success"'; then
            log_test "Add Payment to Settlement" "PASS" "Payment added successfully"
        else
            log_test "Add Payment to Settlement" "FAIL" "Failed to add payment"
        fi

        # Test Escalate Settlement
        ESCALATE_RESPONSE=$(curl -s -X POST "$API_BASE/settlements/$SETTLEMENT_ID/escalate" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"reason\":\"Testing escalation functionality\"}")

        if echo "$ESCALATE_RESPONSE" | grep -q '"status":"success"'; then
            log_test "Escalate Settlement" "PASS" "Settlement escalated successfully"
        else
            log_test "Escalate Settlement" "FAIL" "Failed to escalate settlement"
        fi

    else
        log_test "Create Settlement" "FAIL" "Settlement creation failed"
        echo "Response: $CREATE_SETTLEMENT_RESPONSE"
    fi
else
    log_test "Get Bookings" "FAIL" "Failed to retrieve bookings"
    echo "Response: $BOOKINGS_RESPONSE"
fi

# Test Get All Settlements
ALL_SETTLEMENTS_RESPONSE=$(curl -s -X GET "$API_BASE/settlements" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")

if echo "$ALL_SETTLEMENTS_RESPONSE" | grep -q '"settlements"'; then
    SETTLEMENT_COUNT=$(echo "$ALL_SETTLEMENTS_RESPONSE" | grep -o '"settlements":\[' | wc -l)
    log_test "List All Settlements" "PASS" "Retrieved settlements list"
else
    log_test "List All Settlements" "FAIL" "Failed to retrieve settlements"
fi

# Test Settlement Analytics
ANALYTICS_RESPONSE=$(curl -s -X GET "$API_BASE/settlements/analytics" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")

if echo "$ANALYTICS_RESPONSE" | grep -q '"analytics"'; then
    log_test "Settlement Analytics" "PASS" "Analytics retrieved successfully"
else
    log_test "Settlement Analytics" "FAIL" "Failed to retrieve analytics"
fi

# Test Overdue Settlements
OVERDUE_RESPONSE=$(curl -s -X GET "$API_BASE/settlements/overdue" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")

if echo "$OVERDUE_RESPONSE" | grep -q '"overdueSettlements"'; then
    log_test "Overdue Settlements" "PASS" "Overdue settlements retrieved"
else
    log_test "Overdue Settlements" "FAIL" "Failed to retrieve overdue settlements"
fi

echo ""

# Test Error Handling
echo -e "${BLUE}🚨 Testing Error Handling...${NC}"

# Test Invalid Settlement ID
INVALID_ID_RESPONSE=$(curl -s -X GET "$API_BASE/settlements/invalid-id-123" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")

if echo "$INVALID_ID_RESPONSE" | grep -q '"error"'; then
    log_test "Invalid Settlement ID" "PASS" "Correctly rejected invalid ID"
else
    log_test "Invalid Settlement ID" "FAIL" "Should have returned error for invalid ID"
fi

# Test Permission Error (Guest accessing admin endpoint)
PERMISSION_ERROR_RESPONSE=$(curl -s -X GET "$API_BASE/settlements" \
    -H "Authorization: Bearer $GUEST_TOKEN" \
    -H "Content-Type: application/json")

if echo "$PERMISSION_ERROR_RESPONSE" | grep -q '"error"'; then
    log_test "Permission Error" "PASS" "Correctly rejected guest access"
else
    log_test "Permission Error" "FAIL" "Should have returned permission error"
fi

# Test Invalid Payment Amount
if [ -n "$SETTLEMENT_ID" ]; then
    INVALID_PAYMENT_RESPONSE=$(curl -s -X POST "$API_BASE/settlements/$SETTLEMENT_ID/payment" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"amount\":-1000,\"method\":\"cash\"}")

    if echo "$INVALID_PAYMENT_RESPONSE" | grep -q '"error"'; then
        log_test "Invalid Payment Amount" "PASS" "Correctly rejected negative amount"
    else
        log_test "Invalid Payment Amount" "FAIL" "Should have rejected negative amount"
    fi
fi

echo ""

# Test Frontend Endpoints Availability
echo -e "${BLUE}🌐 Testing Frontend Integration...${NC}"

# Test if React app is accessible
FRONTEND_RESPONSE=$(curl -s -I "http://localhost:3000" | head -1)

if echo "$FRONTEND_RESPONSE" | grep -q "200"; then
    log_test "Frontend Accessibility" "PASS" "React app is accessible"
else
    log_test "Frontend Accessibility" "FAIL" "React app not accessible on port 3000"
fi

echo ""

# Generate Test Report
echo -e "${YELLOW}📋 COMPREHENSIVE API TEST REPORT${NC}"
echo "=" | tr '' '='
echo ""
echo -e "${GREEN}✅ Passed Tests: $PASSED_TESTS${NC}"
echo -e "${RED}❌ Failed Tests: $FAILED_TESTS${NC}"
echo -e "${BLUE}📊 Total Tests: $TOTAL_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "${YELLOW}📈 Success Rate: $SUCCESS_RATE%${NC}"
fi

echo ""
echo "=" | tr '' '='

# Save detailed report to file
REPORT_FILE="payment-system-test-report-$(date +%Y%m%d_%H%M%S).txt"
{
    echo "PAYMENT SYSTEM E2E TEST REPORT"
    echo "Generated: $(date)"
    echo "API Base: $API_BASE"
    echo "Hotel ID: $HOTEL_ID"
    echo ""
    echo "SUMMARY:"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Total: $TOTAL_TESTS"
    echo "Success Rate: $SUCCESS_RATE%"
    echo ""
    echo "AUTHENTICATION STATUS:"
    echo "Admin Token: $([ -n "$ADMIN_TOKEN" ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
    echo "Staff Token: $([ -n "$STAFF_TOKEN" ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
    echo "Guest Token: $([ -n "$GUEST_TOKEN" ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
    echo ""
    echo "TEST IDS CREATED:"
    echo "Booking ID: $BOOKING_ID"
    echo "Settlement ID: $SETTLEMENT_ID"
} > "$REPORT_FILE"

echo -e "${GREEN}📁 Detailed report saved to: $REPORT_FILE${NC}"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi