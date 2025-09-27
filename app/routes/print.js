import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { cors, admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams;
  const orderId = query.get("orderId");

  const response = await admin.graphql(
    `query getOrder($orderId: ID!) {
      order(id: $orderId) {
        name
        createdAt
        subtotalPriceSet {
          shopMoney {
            amount
          }
        }
        totalTaxSet {
          shopMoney {
            amount
          }
        }
        totalPriceSet {
          shopMoney {
            amount
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
          }
        }
        totalShippingPriceSet {
          shopMoney {
            amount
          }
        }
        customer {
          firstName
          lastName
          email
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
        }
        lineItems(first: 10) {
          edges {
            node {
              title
              product {
                description
                descriptionHtml
                featuredImage {
                  url
                  altText
                }
              }
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                }
              }
              discountedUnitPriceSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
      }
    }`,
    {
      variables: {
        orderId: orderId,
      },
    }
  );

  const orderData = await response.json();
  const order = orderData.data.order;
  
  const invoice = orderPage(order);
  const print = printHTML(invoice);

  return cors(
    new Response(print, {
      status: 200,
      headers: {
        "Content-type": "text/html",
      },
    })
  );
}

function orderPage(order) {
  const orderDate = new Date(order.createdAt).toLocaleDateString();
  const subtotal = parseFloat(order.subtotalPriceSet.shopMoney.amount);
  const taxes = parseFloat(order.totalTaxSet.shopMoney.amount);
  const total = parseFloat(order.totalPriceSet.shopMoney.amount);
  const totalDiscounts = parseFloat(order.totalDiscountsSet.shopMoney.amount);
  const totalShipping = parseFloat(order.totalShippingPriceSet.shopMoney.amount);
  console.log(order.lineItems.edges.map(edge => edge.node.product.descriptionHtml));
  
  // Company logo URL - replace with your actual logo URL
  const companyLogoUrl = "https://cdn.shopify.com/s/files/1/0736/0882/3069/files/logo_02d03eb2-da73-4140-a7fa-80e13c3efe71.png?v=1682698240";
  
  let content = `
    <div class="page">
      <div class="header">
        <div class="order-number">
          <strong>Order:</strong> ${order.name}
        </div>
        <div class="company-logo">
          ${companyLogoUrl === "https://cdn.shopify.com/s/files/1/0736/0882/3069/files/logo_02d03eb2-da73-4140-a7fa-80e13c3efe71.png?v=1682698240" ? 
            `<img src="${companyLogoUrl}" alt="Company Logo" class="logo-image" />` : 
            '<div class="logo-placeholder">Company Logo</div>'
          }
        </div>
        <div class="order-date">
          <strong>Date:</strong> ${orderDate}
        </div>
      </div>
      
      <div class="customer-info">
        <h2>Customer Information</h2>
        <div class="customer-details">
          <div class="customer-left">
            <p><strong>Name:</strong> ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}</p>
            <p><strong>Email:</strong> ${order.customer?.email || ''}</p>
          </div>
          <div class="customer-right">
            <p><strong>Address:</strong> ${[
              order.shippingAddress?.address1 || '',
              order.shippingAddress?.address2 || '',
              `${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''} ${order.shippingAddress?.zip || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, ''),
              order.shippingAddress?.country || ''
            ].filter(part => part.trim()).join(', ')}</p>
          </div>
        </div>
      </div>
      
      <div class="items">
        <h2>Items</h2>
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Total</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
  ${order.lineItems.edges.map(edge => {
    const item = edge.node;
    const unitPrice = parseFloat(item.originalUnitPriceSet.shopMoney.amount);
    const totalPrice = unitPrice * item.quantity;
    const productImage = item.product.featuredImage;
    
    return `
      <tr>
        <td class="product-image-cell">
          ${productImage?.url ? 
            `<img src="${productImage.url}" alt="${productImage.altText || item.title}" class="product-image" />` : 
            '<div class="no-image">No Image</div>'
          }
        </td>
        <td>${item.title}</td>
        <td>${item.quantity}</td>
        <td>$${totalPrice.toFixed(2)}</td>
        <td>${item.product.descriptionHtml || item.product.description || ''}</td>
      </tr>
    `;
  }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="totals">
        <div class="totals-row">
          <span class="label">Subtotal:</span>
          <span class="amount">$${subtotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span class="label">Taxes:</span>
          <span class="amount">$${taxes.toFixed(2)}</span>
        </div>
        <div class="totals-row total-row">
          <span class="label">Total Discounts:</span>
          <span class="amount">- $${totalDiscounts.toFixed(2)}</span>
        </div>
        <div class="totals-row total-row">
          <span class="label">Total Shipping:</span>
          <span class="amount">$${totalShipping.toFixed(2)}</span>
        </div>
        <div class="totals-row total-row">
          <span class="label">Total:</span>
          <span class="amount">$${total.toFixed(2)}</span>
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for your business!</p>
      </div>
    </div>
  `;
  
  return content;
}

function printHTML(invoice) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
        }
        
        .page {
          margin-bottom: 30px;
          page-break-after: always;
          border: 1px solid #ddd;
          padding: 20px;
          min-height: 800px;
        }
        
        .page:last-child {
          page-break-after: avoid;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #333;
          padding: 15px 0;
          margin-bottom: 20px;
        }
        
        .order-number, .order-date {
          font-size: 14px;
          color: #333;
        }
        
        .company-logo {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .logo-image {
          max-height: 50px;
          max-width: 150px;
        }
        
        .logo-placeholder {
          height: 40px;
          width: 150px;
          border: 2px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 12px;
        }
        
        .customer-info, .items {
          margin-bottom: 20px;
        }
        
        .customer-info h2, .items h2 {
          color: #333;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
        }
        
        .customer-details {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }
        
        .customer-left, .customer-right {
          flex: 1;
        }
        
        .customer-right {
          text-align: right;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        
        .product-image-cell {
          width: 80px;
          text-align: center;
        }
        
        .product-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
        }
        
        .no-image {
          width: 60px;
          height: 60px;
          background-color: #f5f5f5;
          border: 1px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #666;
          border-radius: 4px;
        }
        
        .totals {
          margin-top: 20px;
          border-top: 2px solid #333;
          padding-top: 15px;
        }
        
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        
        .total-row {
          font-weight: bold;
          font-size: 16px;
          border-top: 1px solid #ddd;
          padding-top: 8px;
          margin-top: 8px;
        }
        
        .label {
          text-align: left;
        }
        
        .amount {
          text-align: right;
          font-weight: bold;
        }
        
        .footer {
          margin-top: 30px;
          text-align: center;
          font-style: italic;
          color: #666;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          .page {
            border: none;
            margin: 0;
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      ${invoice}
    </body>
    </html>
  `;
}
