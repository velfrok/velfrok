
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const cellStyle = {
  padding: "12px",
  textAlign: "left",
  verticalAlign: "top",
  borderBottom: "1px solid #e3e8f0",
};

function getFirstValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function getCustomer(order) {
  const name = getFirstValue(order, [
    "customer_name",
    "full_name",
    "name",
    "customerName",
    "shipping_name",
  ]);

  const email = getFirstValue(order, [
    "customer_email",
    "email",
    "shipping_email",
  ]);

  const phone = getFirstValue(order, [
    "customer_phone",
    "phone",
    "mobile",
    "mobile_number",
    "phone_number",
  ]);

  const userId = getFirstValue(order, ["user_id", "customer_id"]);

  const address = getFirstValue(order, [
    "shipping_address",
    "delivery_address",
    "address",
  ]);

  const pincode = getFirstValue(order, [
    "pincode",
    "postal_code",
    "shipping_pincode",
  ]);

  const key = (
    userId || email || phone || order.id || order.order_code || ""
  ).toLowerCase();

  return {
    key,
    name: name || "Name not available",
    email: email || "—",
    phone: phone || "—",
    userId: userId || "—",
    address: [address, pincode].filter(Boolean).join(", ") || "—",
  };
}

export default function CustomersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      try {
        const response = await fetch("/api/admin/orders", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load customer records."
          );
        }

        if (active) {
          setOrders(Array.isArray(result.orders) ? result.orders : []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load customer records.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCustomers();

    return () => {
      active = false;
    };
  }, []);

  const customers = useMemo(() => {
    const unique = new Map();

    for (const order of orders) {
      const customer = getCustomer(order);

      if (!customer.key) continue;

      if (!unique.has(customer.key)) {
        unique.set(customer.key, {
          ...customer,
          orderCount: 0,
          latestOrder: order.created_at || "",
        });
      }

      const existing = unique.get(customer.key);
      existing.orderCount += 1;

      if (
        order.created_at &&
        (!existing.latestOrder ||
          new Date(order.created_at) > new Date(existing.latestOrder))
      ) {
        existing.latestOrder = order.created_at;
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) =>
        new Date(b.latestOrder || 0) - new Date(a.latestOrder || 0)
    );
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.userId,
        customer.address,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [customers, search]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: "#f5f7fb",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{ color: "#e87528", fontWeight: 700 }}
        >
          ← Back to Admin Dashboard
        </Link>

        <h1 style={{ marginTop: 24, marginBottom: 8 }}>
          Customers
        </h1>

        <p style={{ color: "#68738a", lineHeight: 1.6 }}>
          View unique customers found in your existing order records.
          Customer details depend on the fields stored with each order.
        </p>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            margin: "24px 0",
          }}
        >
          {[
            ["Unique customers", customers.length],
            ["Orders loaded", orders.length],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#fff",
                border: "1px solid #e3e8f0",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <p style={{ color: "#68738a", margin: "0 0 8px" }}>
                {label}
              </p>
              <strong style={{ fontSize: 28 }}>{value}</strong>
            </div>
          ))}
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid #e3e8f0",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <label
            htmlFor="customer-search"
            style={{
              display: "block",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Search customers
          </label>

          <input
            id="customer-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone or customer ID"
            style={{
              boxSizing: "border-box",
              width: "100%",
              padding: 12,
              border: "1px solid #d0d5dd",
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 15,
            }}
          />

          {loading && <p>Loading customers...</p>}

          {!loading && error && (
            <p role="alert" style={{ color: "#b42318" }}>
              {error}
            </p>
          )}

          {!loading && !error && customers.length === 0 && (
            <p>
              No customer records could be derived from the loaded orders.
            </p>
          )}

          {!loading && !error && customers.length > 0 && (
            <>
              <p style={{ color: "#68738a", fontSize: 13 }}>
                Showing {filteredCustomers.length} of {customers.length} customers.
                The Orders API loads up to 200 recent orders.
              </p>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        "Customer",
                        "Email",
                        "Phone",
                        "Customer ID",
                        "Orders",
                        "Latest Order",
                      ].map((heading) => (
                        <th key={heading} style={cellStyle}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.key}>
                        <td style={cellStyle}>{customer.name}</td>
                        <td style={cellStyle}>{customer.email}</td>
                        <td style={cellStyle}>{customer.phone}</td>
                        <td
                          style={{
                            ...cellStyle,
                            maxWidth: 180,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {customer.userId}
                        </td>
                        <td style={cellStyle}>{customer.orderCount}</td>
                        <td style={cellStyle}>
                          {customer.latestOrder
                            ? new Date(customer.latestOrder).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ color: "#68738a", fontSize: 12, marginTop: 16 }}>
                This page is read-only. It does not edit orders or customer
                records.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
