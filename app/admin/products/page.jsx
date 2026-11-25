"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const emptyForm = {
sku: "",
name: "",
slug: "",
price_inr: "",
stock: "",
description: "",
image_url: "",
category: "",
is_active: false,
};

export default function AdminProductsPage() {
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [uploading, setUploading] = useState(false);
const [error, setError] = useState("");
const [message, setMessage] = useState("");
const [editingId, setEditingId] = useState(null);
const [form, setForm] = useState({ ...emptyForm });

const loadProducts = useCallback(async () => {
setLoading(true);
setError("");

try {
  const response = await fetch("/api/admin/products", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load products.");
  }

  setProducts(result.products || []);
} catch (err) {
  setError(err.message || "Unable to load products.");
} finally {
  setLoading(false);
}

}, []);

useEffect(() => {
loadProducts();
}, [loadProducts]);

function updateField(event) {
const { name, value, type, checked } = event.target;

setForm((previous) => ({
  ...previous,
  [name]: type === "checkbox" ? checked : value,
}));

}

async function uploadImage(event) {
const file = event.target.files?.[0];

// Allow choosing the same file again after an error.
event.target.value = "";

if (!file) return;

setError("");
setMessage("");

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

if (!allowedTypes.includes(file.type)) {
  setError("Choose a JPG, PNG, or WebP image.");
  return;
}

if (file.size > 2 * 1024 * 1024) {
  setError("Image size must be 2 MB or less.");
  return;
}

setUploading(true);

try {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Image upload failed.");
  }

  if (!result.url || typeof result.url !== "string") {
    throw new Error("Upload succeeded without returning an image URL.");
  }

  setForm((previous) => ({
    ...previous,
    image_url: result.url,
  }));

  setMessage("Image uploaded successfully. Save the product to keep the URL.");
} catch (err) {
  setError(err.message || "Unable to upload image.");
} finally {
  setUploading(false);
}

}

function startEdit(product) {
setEditingId(product.id);
setMessage("");
setError("");

setForm({
  sku: product.sku || "",
  name: product.name || "",
  slug: product.slug || "",
  price_inr: String(product.price_inr ?? ""),
  stock: String(product.stock ?? ""),
  description: product.description || "",
  image_url: product.image_url || "",
  category: product.category || "",
  is_active: product.is_active === true,
});

window.scrollTo({ top: 0, behavior: "smooth" });

}

function cancelEdit() {
setEditingId(null);
setForm({ ...emptyForm });
setError("");
setMessage("");
}

async function saveProduct(event) {
event.preventDefault();
setError("");
setMessage("");
setSaving(true);

try {
  const isEditing = editingId !== null;

  const payload = {
    ...form,
    price_inr: Number(form.price_inr),
    stock: Number(form.stock),
  };

  if (isEditing) {
    payload.id = editingId;
  }

  const response = await fetch("/api/admin/products", {
    method: isEditing ? "PATCH" : "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error ||
        (isEditing
          ? "Unable to update product."
          : "Unable to add product.")
    );
  }

  setMessage(
    isEditing
      ? "Product updated successfully."
      : "Product added successfully."
  );

  setEditingId(null);
  setForm({ ...emptyForm });

  await loadProducts();
} catch (err) {
  setError(err.message || "Unable to save product.");
} finally {
  setSaving(false);
}

}

const inputStyle = {
width: "100%",
boxSizing: "border-box",
padding: "11px",
border: "1px solid #d7deea",
borderRadius: "8px",
background: "#fff",
color: "#172033",
fontSize: "14px",
};

const labelStyle = {
display: "block",
marginBottom: "6px",
fontWeight: 700,
fontSize: "14px",
};

return (
<main
style={{
minHeight: "100vh",
background: "#f5f7fb",
color: "#172033",
padding: "20px",
fontFamily: "Arial, sans-serif",
}}
>
<div style={{ maxWidth: "1100px", margin: "0 auto" }}>
<Link
href="/admin"
style={{
color: "#e87528",
textDecoration: "none",
fontWeight: 700,
}}
>
← Back to Admin Dashboard
</Link>

    <h1 style={{ marginTop: "24px" }}>Products</h1>

    <p style={{ color: "#68738a", lineHeight: 1.6 }}>
      Add products, upload images, and manage your VELFROK listings.
    </p>

    {error && (
      <div
        role="alert"
        style={{
          marginTop: "16px",
          padding: "12px",
          borderRadius: "8px",
          background: "#fff0f0",
          color: "#a51d2d",
        }}
      >
        {error}
      </div>
    )}

    {message && (
      <div
        role="status"
        style={{
          marginTop: "16px",
          padding: "12px",
          borderRadius: "8px",
          background: "#e8f8ee",
          color: "#176b38",
        }}
      >
        {message}
      </div>
    )}

    <section
      style={{
        marginTop: "24px",
        padding: "20px",
        background: "#fff",
        border: "1px solid #e3e8f0",
        borderRadius: "16px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        {editingId ? "Edit product" : "Add a product"}
      </h2>

      {editingId && (
        <p style={{ color: "#68738a", lineHeight: 1.5 }}>
          You are editing an existing product. Its ID will remain unchanged.
        </p>
      )}

      <form onSubmit={saveProduct}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="sku">SKU *</label>
            <input
              id="sku"
              name="sku"
              value={form.sku}
              onChange={updateField}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="name">Product name *</label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={updateField}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="slug">Slug *</label>
            <input
              id="slug"
              name="slug"
              value={form.slug}
              onChange={updateField}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="price_inr">
              Selling price (₹) *
            </label>
            <input
              id="price_inr"
              name="price_inr"
              type="number"
              min="0"
              step="1"
              value={form.price_inr}
              onChange={updateField}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="stock">Stock quantity *</label>
            <input
              id="stock"
              name="stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={updateField}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="category">Category</label>
            <input
              id="category"
              name="category"
              value={form.category}
              onChange={updateField}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="product-image">
              Upload product image
            </label>
            <input
              id="product-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadImage}
              disabled={uploading || saving}
              style={{ ...inputStyle, padding: "8px" }}
            />
            <p style={{ color: "#68738a", fontSize: "12px", lineHeight: 1.5 }}>
              JPG, PNG, or WebP. Maximum size: 2 MB.
            </p>
            {uploading && <p role="status">Uploading image...</p>}

            {form.image_url && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700 }}>
                  Image preview
                </p>
                <img
                  src={form.image_url}
                  alt="Product preview"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    display: "block",
                    width: "150px",
                    height: "150px",
                    objectFit: "contain",
                    border: "1px solid #e3e8f0",
                    borderRadius: "8px",
                    background: "#fff",
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      image_url: "",
                    }))
                  }
                  disabled={saving || uploading}
                  style={{
                    marginTop: "8px",
                    padding: "7px 10px",
                    border: "1px solid #d7deea",
                    borderRadius: "6px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Remove image URL
                </button>
              </div>
            )}

            <label
              htmlFor="image_url"
              style={{ ...labelStyle, marginTop: "14px" }}
            >
              Or enter an image URL
            </label>
            <input
              id="image_url"
              name="image_url"
              type="url"
              value={form.image_url}
              onChange={updateField}
              style={inputStyle}
              placeholder="https://..."
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={updateField}
              style={{ ...inputStyle, minHeight: "90px" }}
            />
          </div>
        </div>

        <label
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            marginTop: "18px",
          }}
        >
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={updateField}
          />
          Make this product active and visible in the store
        </label>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "20px",
          }}
        >
          <button
            type="submit"
            disabled={saving || uploading}
            style={{
              padding: "12px 20px",
              background: saving || uploading ? "#9ca3af" : "#e87528",
              color: "#fff",
              border: 0,
              borderRadius: "8px",
              fontWeight: 700,
              cursor: saving || uploading ? "wait" : "pointer",
            }}
          >
            {uploading
              ? "Uploading image..."
              : saving
                ? "Saving..."
                : editingId
                  ? "Update Product"
                  : "Add Product"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving || uploading}
              style={{
                padding: "12px 20px",
                background: "#fff",
                color: "#172033",
                border: "1px solid #d7deea",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>
    </section>

    <section
      style={{
        marginTop: "24px",
        padding: "20px",
        background: "#fff",
        border: "1px solid #e3e8f0",
        borderRadius: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Existing products</h2>
        <button
          type="button"
          onClick={loadProducts}
          disabled={loading || saving || uploading}
          style={{
            padding: "9px 14px",
            border: "1px solid #d7deea",
            borderRadius: "8px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "720px",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ background: "#172033", color: "#fff" }}>
                {["SKU", "Product", "Price", "Stock", "Status", "Action"].map(
                  (heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  style={{ borderBottom: "1px solid #e3e8f0" }}
                >
                  <td style={{ padding: "12px" }}>{product.sku || "—"}</td>
                  <td style={{ padding: "12px" }}>{product.name || "—"}</td>
                  <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                    ₹{Number(product.price_inr || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "12px" }}>{product.stock ?? 0}</td>
                  <td style={{ padding: "12px" }}>
                    {product.is_active ? "Active" : "Inactive"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      disabled={saving || uploading}
                      style={{
                        padding: "8px 12px",
                        background: "#172033",
                        color: "#fff",
                        border: 0,
                        borderRadius: "6px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </div>
</main>

);
}
