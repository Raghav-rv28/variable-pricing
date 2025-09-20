// GraphQL queries and mutations for the Weight Multiplier Block extension

export const GET_PRODUCT_VARIANTS = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      variants(first: 10) {
        edges {
          node {
            id
            price
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
`;

export const BULK_UPDATE_PRODUCT_VARIANTS = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      productVariants {
        id
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;
