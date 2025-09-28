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
              product {
                featuredImage {
                  url
                  altText
                }
                variants(first: 1) {
                  edges {
                    node {
                      inventoryItem {
                        measurement {
                          weight {
                            unit
                            value
                          }
                        }
                      }
                    }
                  }
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
  
  const appraisal = appraisalPage(order);
  const print = printHTML(appraisal);

  return cors(
    new Response(print, {
      status: 200,
      headers: {
        "Content-type": "text/html",
      },
    })
  );
}

function appraisalPage(order) {
  const appraisalDate = new Date(order.createdAt).toLocaleDateString();
  const subtotal = parseFloat(order.subtotalPriceSet.shopMoney.amount);
  const total = parseFloat(order.totalPriceSet.shopMoney.amount);
  const totalDiscounts = parseFloat(order.totalDiscountsSet.shopMoney.amount);
  const totalShipping = parseFloat(order.totalShippingPriceSet.shopMoney.amount);
  
  // Company logo URL
  const companyLogoUrl = "https://cdn.shopify.com/s/files/1/0736/0882/3069/files/logo_02d03eb2-da73-4140-a7fa-80e13c3efe71.png?v=1682698240";
  
  // Business information
  const businessInfo = {
    name: "Dubai Jewellers", // Replace with actual business name
    address: "2700 N Park Dr, Unit #19",
    city: "Brampton, ON L6S 0E9",
    phone: "416-465-1200"
  };
  
  let content = `
    <div class="page">
      <div class="header">
        <div class="header-left">
          <div class="company-logo">
            ${companyLogoUrl === "https://cdn.shopify.com/s/files/1/0736/0882/3069/files/logo_02d03eb2-da73-4140-a7fa-80e13c3efe71.png?v=1682698240" ? 
              `<img src="${companyLogoUrl}" alt="Company Logo" class="logo-image" />` : 
              '<div class="logo-placeholder">Company Logo</div>'
            }
          </div>
        </div>
        <div class="header-right">
          <div class="business-info-compact">
            <div class="business-name">${businessInfo.name}</div>
            <div class="business-address">${businessInfo.address}</div>
            <div class="business-city">${businessInfo.city}</div>
            <div class="business-phone">Phone: ${businessInfo.phone}</div>
          </div>
          <div class="header-details">
            <div class="appraisal-number">
              <strong>Appraisal #:</strong> ${order.name}
            </div>
            <div class="appraisal-date">
              <strong>Date:</strong> ${appraisalDate}
            </div>
          </div>
        </div>
      </div>
      
      <div class="disclaimers-top">
        <p><strong>Valuation Basis:</strong> This appraisal represents estimated value based on <strong>current market conditions</strong> and our <strong>professional assessment</strong>. Values are dependent on <strong>current gold prices</strong> and <strong>market fluctuations</strong>.</p>
        <p><strong>No Liability:</strong> We assume <strong>no liability</strong> for actions taken based on this appraisal. This document is for <strong>informational purposes only</strong> and not a guarantee of value or purchase commitment.</p>
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
        <h2>Appraised Items</h2>
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Item Name</th>
              <th>Weight (grams)</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
  ${order.lineItems.edges.map(edge => {
    const item = edge.node;
    const unitPrice = parseFloat(item.originalUnitPriceSet.shopMoney.amount);
    const totalPrice = unitPrice * item.quantity;
    
    // Get weight from the new query structure
    const weightData = item.product?.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
    const weight = weightData ? `${weightData.value} ${weightData.unit}` : 'N/A';
    
    // Get image from the new query structure
    const productImage = item.product?.featuredImage;
    
    return `
      <tr>
        <td class="product-image-cell">
          ${productImage?.url ? 
            `<img src="${productImage.url}" alt="${productImage.altText || item.title}" class="product-image" />` : 
            '<div class="no-image">No Image</div>'
          }
        </td>
        <td>${item.title}</td>
        <td>${weight}</td>
        <td>${item.quantity}</td>
        <td>$${unitPrice.toFixed(2)}</td>
        <td>$${totalPrice.toFixed(2)}</td>
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
      ${totalDiscounts > 0 ? `
        <div class="totals-row total-row">
          <span class="label">Total Discounts:</span>
          <span class="amount">- $${totalDiscounts.toFixed(2)}</span>
        </div>` : ''}
        ${totalShipping > 0 ? `
        <div class="totals-row total-row">
          <span class="label">Total Shipping:</span>
          <span class="amount">$${totalShipping.toFixed(2)}</span>
        </div>` : ''}

        <div class="totals-row total-row">
          <span class="label">Total Appraised Value:</span>
          <span class="amount">$${total.toFixed(2)}</span>
        </div>
      </div>
      
      <div class="disclaimers-bottom">
        <p><strong>Purchase Policy:</strong> We do not <strong>guarantee to purchase</strong> items at appraised value. Purchase decisions are at our <strong>sole discretion</strong> and subject to <strong>verification and market conditions</strong>.</p>
        <p><strong>Professional Opinion:</strong> This represents our <strong>professional opinion</strong> based on <strong>visual inspection</strong>. Not certified for <strong>insurance, legal, or tax purposes</strong> without additional verification.</p>
      </div>
      
      <div class="footer">
        <p><strong>Thank you for your business!</strong></p>
        <p>For questions regarding this appraisal, please contact us at ${businessInfo.phone}</p>
      </div>
    </div>
  `;
  
  return content;
}

function printHTML(appraisal) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Gold Appraisal</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
          line-height: 1.6;
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
          align-items: flex-start;
          border-bottom: 2px solid #333;
          padding: 15px 0;
          margin-bottom: 20px;
        }
        
        .header-left {
          flex: 0 0 auto;
        }
        
        .header-right {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-left: 20px;
        }
        
        .company-logo {
          display: flex;
          align-items: center;
          justify-content: flex-start;
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
        
        .business-info-compact {
          flex: 1;
          margin-right: 20px;
        }
        
        .business-name {
          font-weight: bold;
          font-size: 16px;
          color: #333;
          margin-bottom: 2px;
        }
        
        .business-address, .business-city, .business-phone {
          font-size: 12px;
          color: #666;
          line-height: 1.3;
        }
        
        .header-details {
          flex: 0 0 auto;
          text-align: right;
        }
        
        .appraisal-number, .appraisal-date {
          font-size: 14px;
          color: #333;
          margin-bottom: 2px;
        }
        
        .customer-info, .items, .disclaimers-top, .disclaimers-bottom {
          margin-bottom: 15px;
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
          margin-top: 8px;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 6px;
          text-align: left;
          font-size: 12px;
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
          margin-top: 12px;
          border-top: 2px solid #333;
          padding-top: 8px;
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
        
        .disclaimers-top, .disclaimers-bottom {
          margin-bottom: 10px;
        }
        
        .disclaimers-top p, .disclaimers-bottom p {
          margin-bottom: 5px;
          font-size: 10px;
          line-height: 1.3;
          font-style: italic;
          color: #555;
        }
        
        .footer {
          margin-top: 15px;
          text-align: center;
          font-style: italic;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 8px;
          font-size: 11px;
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
      ${appraisal}
    </body>
    </html>
  `;
}
