import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  TextField,
  Select,
  DataTable,
  Checkbox,
  Banner,
  Spinner,
  Filters,
  ChoiceList,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// GraphQL Queries
const GET_COLLECTIONS = `#graphql
  query getCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          productsCount {
            count
          }
        }
      }
    }
  }
`;

const GET_COLLECTION_PRODUCTS = `#graphql
  query getCollectionProducts($collectionId: ID!, $first: Int!) {
    collection(id: $collectionId) {
      id
      title
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            status
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
      }
    }
  }
`;

const BULK_UPDATE_VARIANTS = `#graphql
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Get collections for the dropdown
  const collectionsResponse = await admin.graphql(GET_COLLECTIONS, {
    variables: { first: 50 }
  });
  
  const collectionsData = await collectionsResponse.json();
  const collections = collectionsData.data?.collections?.edges?.map((edge: any) => ({
    value: edge.node.id,
    label: `${edge.node.title} (${edge.node.productsCount.count} products)`,
  })) || [];

  return { collections };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "getProducts") {
    const collectionId = formData.get("collectionId") as string;
    
    const response = await admin.graphql(GET_COLLECTION_PRODUCTS, {
      variables: { 
        collectionId, 
        first: 100
      }
    });
    
    const data = await response.json();
    return { products: data.data?.collection?.products?.edges || [] };
  }

  if (actionType === "updatePrices") {
    const selectedProducts = JSON.parse(formData.get("selectedProducts") as string);
    const multiplier = parseFloat(formData.get("multiplier") as string);
    
    const results = [];
    const errors = [];

    for (const product of selectedProducts) {
      try {
        const variantsToUpdate = product.variants
          .filter((variant: any) => {
            const weight = variant.inventoryItem?.measurement?.weight?.value;
            const weightUnit = variant.inventoryItem?.measurement?.weight?.unit;
            return weight && weight > 0 && weightUnit === 'g';
          })
          .map((variant: any) => {
            const weight = variant.inventoryItem.measurement.weight.value;
            const newPrice = (parseFloat(weight) * multiplier).toFixed(2);
            return {
              id: variant.id,
              price: newPrice
            };
          });

        if (variantsToUpdate.length > 0) {
          const updateResponse = await admin.graphql(BULK_UPDATE_VARIANTS, {
            variables: {
              productId: product.id,
              variants: variantsToUpdate
            }
          });

          const updateData = await updateResponse.json();
          const userErrors = updateData.data?.productVariantsBulkUpdate?.userErrors || [];
          
          if (userErrors.length > 0) {
            errors.push(`${product.title}: ${userErrors.map((e: any) => e.message).join(', ')}`);
          } else {
            results.push({
              productTitle: product.title,
              variantsUpdated: variantsToUpdate.length
            });
          }
        }
      } catch (error) {
        errors.push(`${product.title}: ${error}`);
      }
    }

    return { results, errors };
  }

  return null;
};

export default function Index() {
  const { collections } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selectedCollection, setSelectedCollection] = useState("");
  const [multiplier, setMultiplier] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const isLoadingProducts = fetcher.state === "submitting" && 
    fetcher.formData?.get("actionType") === "getProducts";
  const isUpdatingPrices = fetcher.state === "submitting" && 
    fetcher.formData?.get("actionType") === "updatePrices";

  // Load products when collection changes
  useEffect(() => {
    if (selectedCollection) {
      const formData = new FormData();
      formData.append("actionType", "getProducts");
      formData.append("collectionId", selectedCollection);
      formData.append("searchQuery", searchQuery);
      fetcher.submit(formData, { method: "POST" });
    }
  }, [selectedCollection, searchQuery]);

  // Update products when fetcher data changes
  useEffect(() => {
    if (fetcher.data && 'products' in fetcher.data && fetcher.data.products) {
      const productData = fetcher.data.products.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        status: edge.node.status,
        variants: edge.node.variants.edges.map((variantEdge: any) => variantEdge.node),
        hasWeight: edge.node.variants.edges.some((variantEdge: any) => 
          variantEdge.node.inventoryItem?.measurement?.weight?.value > 0
        )
      }));
      setProducts(productData);
      setSelectedProducts(new Set());
      setSelectAll(false);
    }
  }, [fetcher.data]);

// Handle update results
useEffect(() => {
  if (fetcher.data && 'results' in fetcher.data && fetcher.data.results) {
    const { results, errors } = fetcher.data;
    if (results.length > 0) {
      const totalUpdated = results.reduce((sum: number, r: any) => sum + r.variantsUpdated, 0);
      setMessage(`Successfully updated ${totalUpdated} variants across ${results.length} products.`);
      shopify.toast.show("Prices updated successfully");
    }
    if (errors && errors.length > 0) {
      setMessage(`Errors occurred: ${errors.join('; ')}`);
    }
  }
}, [fetcher.data, shopify]);

  const filteredProducts = products.filter(product => {
    if (statusFilter.length > 0 && !statusFilter.includes(product.status.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleProductSelect = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
    setSelectAll(newSelected.size === filteredProducts.length);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
    setSelectAll(checked);
  };

  const handleUpdatePrices = () => {
    if (!multiplier || isNaN(parseFloat(multiplier))) {
      setMessage("Please enter a valid multiplier");
      return;
    }
    if (selectedProducts.size === 0) {
      setMessage("Please select at least one product");
      return;
    }

    const selectedProductData = filteredProducts.filter(p => selectedProducts.has(p.id));
    const formData = new FormData();
    formData.append("actionType", "updatePrices");
    formData.append("selectedProducts", JSON.stringify(selectedProductData));
    formData.append("multiplier", multiplier);
    
    fetcher.submit(formData, { method: "POST" });
  };

  const tableRows = filteredProducts.map(product => {
    const firstVariant = product.variants[0];
    const firstVariantWeight = firstVariant?.inventoryItem?.measurement?.weight?.value;
    const firstVariantPrice = firstVariant?.price;
    
    const weightDisplay = firstVariantWeight ? `${firstVariantWeight}g` : 'N/A';
    const priceDisplay = firstVariantPrice ? `$${firstVariantPrice}` : 'N/A';

    return [
      <Checkbox
        label=""
        key={product.id}
        checked={selectedProducts.has(product.id)}
        onChange={(checked) => handleProductSelect(product.id, checked)}
        disabled={!product.hasWeight}
      />,
      product.title,
      product.status,
      product.variants.length.toString(),
      weightDisplay,
      priceDisplay
    ];
  });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter([]);
  };

  const filters = [
    {
      key: 'status',
      label: 'Product Status',
      filter: (
        <ChoiceList
          title="Product Status"
          titleHidden
          choices={[
            { label: 'Active', value: 'active' },
            { label: 'Draft', value: 'draft' },
            { label: 'Archived', value: 'archived' },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.map(status => ({
    key: `status-${status}`,
    label: `Status: ${status}`,
    onRemove: () => setStatusFilter(statusFilter.filter(s => s !== status)),
  }));

  return (
    <Page>
      <TitleBar title="Bulk Weight Price Multiplier" />
      
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Bulk Price Update Tool
            </Text>
            <Text variant="bodyMd" as="p">
              Select a collection and multiply product variant prices by their weight and a custom multiplier.
              New price = weight (grams) × multiplier
            </Text>
            
            <InlineStack gap="400" align="start">
              <Box minWidth="200px">
                <Select
                  label="Select Collection"
                  options={[
                    { label: "Choose a collection", value: "" },
                    ...collections
                  ]}
                  value={selectedCollection}
                  onChange={setSelectedCollection}
                />
              </Box>
              
              <Box minWidth="150px">
                <TextField
                  label="Multiplier"
                  value={multiplier}
                  onChange={setMultiplier}
                  type="number"
                  autoComplete=""
                  step={0.01}
                  placeholder="e.g., 2.5"
                />
              </Box>
              
              <Box paddingBlockStart="600">
                <Button
                  variant="primary"
                  onClick={handleUpdatePrices}
                  disabled={!selectedCollection || !multiplier || selectedProducts.size === 0 || isUpdatingPrices}
                  loading={isUpdatingPrices}
                >
                  Update Prices ({selectedProducts.size.toLocaleString()} selected)
                </Button>
              </Box>
            </InlineStack>

            {message && (
              <Banner>
                <p>{message}</p>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {selectedCollection && (
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" align="space-between">
                <Text as="h3" variant="headingMd">
                  Products in Collection
                </Text>
                {isLoadingProducts && <Spinner size="small" />}
              </InlineStack>

              <Filters
                queryValue={searchQuery}
                queryPlaceholder="Search products..."
                filters={filters}
                appliedFilters={appliedFilters}
                onQueryChange={setSearchQuery}
                onQueryClear={() => setSearchQuery("")}
                onClearAll={clearFilters}
              />

              {products.length > 0 && (
                <>
                  <InlineStack gap="300">
                    <Checkbox
                      label="Select All"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                    <Text variant="bodyMd" as="p">
                      {selectedProducts.size} of {filteredProducts.length} products selected
                    </Text>
                  </InlineStack>

                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                    headings={['Select', 'Product Title', 'Status', 'Variants', 'First Variant Weight', 'First Variant Price']}
                    rows={tableRows}
                    hoverable
                  />
                </>
              )}

              {products.length === 0 && selectedCollection && !isLoadingProducts && (
                <Box padding="400">
                  <Text alignment="center" as="p">
                    No products found in this collection.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}