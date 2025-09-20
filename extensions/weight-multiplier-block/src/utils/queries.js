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

export const UPDATE_PRODUCT_VARIANT = `
  mutation productVariantUpdate($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant {
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
