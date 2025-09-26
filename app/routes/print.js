import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { cors, admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams;
  const docs = query.get("printType").split(",");
  const orderId = query.get("orderId");

  const response = await admin.graphql(
    `query getOrder($orderId: ID!) {
      order(id: $orderId) {
        name
        createdAt
        totalPriceSet {
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
              }
              quantity
              originalUnitPriceSet {
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
 
  const pages = docs.map((docType) => orderPage(docType, order));
  const print = printHTML(pages);

  return cors(
    new Response(print, {
      status: 200,
      headers: {
        "Content-type": "text/html",
      },
    })
  );
}

function orderPage(docType, order) {
  const orderDate = new Date(order.createdAt).toLocaleDateString();
  const orderTotal = order.totalPriceSet.shopMoney.amount;
  
  // Customize content based on document type
  let headerTitle = docType;
  let showShippingInfo = true;
  let showItems = true;
  
  if (docType === "Receipt") {
    headerTitle = "Receipt";
    showShippingInfo = false; // Receipts typically don't show shipping
  } else if (docType === "Packing Slip") {
    headerTitle = "Packing Slip";
    showItems = true; // Packing slips focus on items
  }
  
  let content = `
    <div class="page">
      <div class="header">
        <h1>${headerTitle}</h1>
        <div class="order-info">
          <p><strong>Order:</strong> ${order.name}</p>
          <p><strong>Date:</strong> ${orderDate}</p>
          <p><strong>Total:</strong> $${orderTotal}</p>
        </div>
      </div>
      
      <div class="customer-info">
        <h2>Customer Information</h2>
        <p><strong>Name:</strong> ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}</p>
        <p><strong>Email:</strong> ${order.customer?.email || ''}</p>
      </div>
      
      ${showShippingInfo ? `
      <div class="shipping-info">
        <h2>Shipping Address</h2>
        <p>${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}</p>
        <p>${order.shippingAddress?.address1 || ''}</p>
        ${order.shippingAddress?.address2 ? `<p>${order.shippingAddress.address2}</p>` : ''}
        <p>${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''} ${order.shippingAddress?.zip || ''}</p>
        <p>${order.shippingAddress?.country || ''}</p>
      </div>
      ` : ''}
      
      ${showItems ? `
      <div class="items">
        <h2>Items</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
  ` : ''}
  
  ${showItems ? order.lineItems.edges.map(edge => {
    const item = edge.node;
    const price = item.originalUnitPriceSet.shopMoney.amount;
    return `
      <tr>
        <td>${item.title}</td>
        <td>${item.quantity}</td>
        <td>$${price}</td>
        <td>${item.product.description || ''}</td>
      </tr>
    `;
  }).join('') : ''}
  
  ${showItems ? `
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <div class="footer">
        <p>Thank you for your business!</p>
      </div>
    </div>
  `;
  
  return content;
}

function printHTML(pages) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Print Documents</title>
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
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          color: #333;
        }
        
        .order-info {
          display: flex;
          gap: 20px;
        }
        
        .order-info p {
          margin: 5px 0;
        }
        
        .customer-info, .shipping-info, .items {
          margin-bottom: 20px;
        }
        
        .customer-info h2, .shipping-info h2, .items h2 {
          color: #333;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
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
      ${pages.join('')}
    </body>
    </html>
  `;
}
