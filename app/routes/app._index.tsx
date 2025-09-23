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
  Pagination,
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
  // Server env diagnostics (safe)
  try {
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      PORT: process.env.PORT,
      HAS_API_KEY: Boolean(process.env.SHOPIFY_API_KEY),
      HAS_API_SECRET: Boolean(process.env.SHOPIFY_API_SECRET),
      HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
    };
    console.log("[Loader] Env summary:", safeEnv);
  } catch (e) {
    console.warn("[Loader] Failed to log env summary:", e);
  }

  try {
    const { admin } = await authenticate.admin(request);
    console.log("[Loader] Authenticated admin for collections fetch");
  
    // Get collections for the dropdown
    const collectionsResponse = await admin.graphql(GET_COLLECTIONS, {
      variables: { first: 50 }
    });
    const collectionsData = await collectionsResponse.json();

    if (!collectionsData?.data) {
      console.error("[Loader] Collections response missing data", collectionsData);
    }

    const collections = collectionsData.data?.collections?.edges?.map((edge: any) => ({
      value: edge.node.id,
      label: `${edge.node.title} (${edge.node.productsCount.count} products)`,
    })) || [];

    console.log(`[Loader] Loaded ${collections.length} collections`);
    return { collections };
  } catch (error) {
    console.error("[Loader] Error loading collections:", error);
    throw error;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    console.log("[Action] Received actionType=", actionType);

    if (actionType === "getProducts") {
      const collectionId = formData.get("collectionId") as string;
      const searchQuery = (formData.get("searchQuery") as string) || "";
      if (!collectionId) {
        console.error("[Action:getProducts] Missing collectionId");
        return { products: [], errors: ["Missing collectionId"], action: "getProducts" };
      }

      try {
        const response = await admin.graphql(GET_COLLECTION_PRODUCTS, {
          variables: { 
            collectionId, 
            first: 100
          }
        });
        const data = await response.json();

        if (!data?.data?.collection) {
          console.error("[Action:getProducts] No collection in response", data);
        }

        const edges = data.data?.collection?.products?.edges || [];
        console.log(`[Action:getProducts] searchQuery='${searchQuery}', products=${edges.length}`);
        return { products: edges, action: "getProducts" };
      } catch (err) {
        console.error("[Action:getProducts] Error fetching products:", err);
        return { products: [], errors: [String(err)], action: "getProducts" };
      }
    }

    if (actionType === "updatePrices") {
      const selectedProducts = JSON.parse(formData.get("selectedProducts") as string);
      const multiplier = parseFloat(formData.get("multiplier") as string);

      console.log(`[Action:updatePrices] products=${selectedProducts?.length || 0}, multiplier=${multiplier}`);
      
      const results: any[] = [];
      const errors: string[] = [];

      for (const product of selectedProducts) {
        try {
          const variantsToUpdate = product.variants
            .filter((variant: any) => {
              const weight = variant.inventoryItem?.measurement?.weight?.value;
              return weight && weight > 0;
            })
            .map((variant: any) => {
              const weight = variant.inventoryItem.measurement.weight.value;
              const newPrice = (parseFloat(weight) * multiplier).toFixed(2);
              return {
                id: variant.id,
                price: newPrice
              };
            });

          console.log(`[Action:updatePrices] '${product.title}' variantsToUpdate=${variantsToUpdate.length}`);

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
              console.error(`[Action:updatePrices] UserErrors for '${product.title}':`, userErrors);
              errors.push(`${product.title}: ${userErrors.map((e: any) => e.message).join(', ')}`);
            } else {
              results.push({
                productTitle: product.title,
                variantsUpdated: variantsToUpdate.length
              });
            }
          }
        } catch (error) {
          console.error(`[Action:updatePrices] Error for '${product.title}':`, error);
          errors.push(`${product.title}: ${error}`);
        }
      }

      console.log(`[Action:updatePrices] Done. results=${results.length}, errors=${errors.length}`);
      return { results, errors, action: "updatePrices" };
    }

    console.warn("[Action] Unknown actionType", actionType);
    return { errors: ["Unknown actionType"], action: String(actionType) };
  } catch (error) {
    console.error("[Action] Top-level error:", error);
    return { errors: ["Unexpected server error"], action: "unknown" };
  }
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
  const [selectAllMode, setSelectAllMode] = useState<'page' | 'collection'>('page');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  const isLoadingProducts = fetcher.state === "submitting" && 
    fetcher.formData?.get("actionType") === "getProducts";
  const isUpdatingPrices = fetcher.state === "submitting" && 
    fetcher.formData?.get("actionType") === "updatePrices";

  // Client diagnostics
  useEffect(() => {
    console.log("[Client] selectedCollection=", selectedCollection);
  }, [selectedCollection]);

  useEffect(() => {
    if (fetcher.state === "idle") return;
    console.log("[Client] fetcher state:", fetcher.state, "formData.actionType=", fetcher.formData?.get("actionType"));
  }, [fetcher.state]);

  // Load products when collection changes
  useEffect(() => {
    if (selectedCollection) {
      const formData = new FormData();
      formData.append("actionType", "getProducts");
      formData.append("collectionId", selectedCollection);
      formData.append("searchQuery", searchQuery);
      console.log("[Client] Submitting getProducts for collection:", selectedCollection);
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
      console.log(`[Client] Received products: ${productData.length}`);
      setProducts(productData);
      setSelectedProducts(new Set());
      setSelectAll(false);
    }
  }, [fetcher.data]);

// Handle update results
useEffect(() => {
  if (fetcher.data && 'results' in fetcher.data && fetcher.data.results) {
    const { results, errors } = fetcher.data as any;
    console.log(`[Client] Update results=${results.length}, errors=${errors?.length || 0}`);
    if (results.length > 0) {
      const totalUpdated = results.reduce((sum: number, r: any) => sum + r.variantsUpdated, 0);
      setMessage(`Successfully updated ${totalUpdated} variants across ${results.length} products.`);
      shopify.toast.show("Prices updated successfully");
      
      // Automatically refresh product data to show updated prices
      if (selectedCollection) {
        const formData = new FormData();
        formData.append("actionType", "getProducts");
        formData.append("collectionId", selectedCollection);
        formData.append("searchQuery", searchQuery);
        fetcher.submit(formData, { method: "POST" });
      }
    }
    if (errors && errors.length > 0) {
      setMessage(`Errors occurred: ${errors.join('; ')}`);
      try { shopify.toast.show("Errors occurred while updating prices"); } catch {}
    }
  }
}, [fetcher.data, shopify, selectedCollection, searchQuery]);

// Handle generic errors returned from actions without results (e.g., getProducts errors)
useEffect(() => {
  if (fetcher.data && 'errors' in fetcher.data && (!('results' in fetcher.data) || !fetcher.data.results)) {
    const { errors, action } = fetcher.data as any;
    if (errors && errors.length > 0) {
      console.error(`[Client] Action '${action}' returned errors:`, errors);
      setMessage(`Errors occurred: ${errors.join('; ')}`);
      try { shopify.toast.show(`Error: ${errors[0]}`); } catch {}
    }
  }
}, [fetcher.data, shopify]);

  const filteredProducts = products.filter(product => {
    if (statusFilter.length > 0 && !statusFilter.includes(product.status.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handleProductSelect = (productId: string, checked: boolean) => {
    console.log(`[Client] Product select ${checked ? 'on' : 'off'}:`, productId);
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
    updateSelectAllState(newSelected);
  };

  const updateSelectAllState = (selectedSet: Set<string>) => {
    if (selectAllMode === 'page') {
      setSelectAll(selectedSet.size === paginatedProducts.length && paginatedProducts.length > 0);
    } else {
      setSelectAll(selectedSet.size === filteredProducts.length && filteredProducts.length > 0);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    console.log(`[Client] SelectAll ${checked ? 'on' : 'off'} mode=${selectAllMode}`);
    if (checked) {
      if (selectAllMode === 'page') {
        // Select all products on current page
        const pageProductIds = paginatedProducts.map(p => p.id);
        const newSelected = new Set([...selectedProducts, ...pageProductIds]);
        setSelectedProducts(newSelected);
      } else {
        // Select all products in collection
        setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
      }
    } else {
      if (selectAllMode === 'page') {
        // Deselect all products on current page
        const pageProductIds = paginatedProducts.map(p => p.id);
        const newSelected = new Set([...selectedProducts].filter(id => !pageProductIds.includes(id)));
        setSelectedProducts(newSelected);
      } else {
        // Deselect all products in collection
        setSelectedProducts(new Set());
      }
    }
    setSelectAll(checked);
  };

  const handleSelectAllModeChange = (mode: 'page' | 'collection') => {
    console.log("[Client] selectAllMode=", mode);
    setSelectAllMode(mode);
    setSelectAll(false);
    updateSelectAllState(selectedProducts);
  };

  const handleUpdatePrices = () => {
    console.log("[Client] handleUpdatePrices clicked. selected=", selectedProducts.size, "multiplier=", multiplier);
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

    console.log(`[Client] Submitting updatePrices for products=${selectedProductData.length}`);
    fetcher.submit(formData, { method: "POST" });
  };

  const tableRows = paginatedProducts.map(product => {
    const firstVariant = product.variants[0];
    const firstVariantWeight = firstVariant?.inventoryItem?.measurement?.weight?.value;
    const firstVariantPrice = firstVariant?.price;
    
    const weightDisplay = firstVariantWeight ? `${firstVariantWeight}g` : 'N/A';
    const priceDisplay = firstVariantPrice ? `$${firstVariantPrice}` : 'N/A';
    
    // Calculate modifier (price per gram)
    let modifierDisplay = 'N/A';
    if (firstVariantWeight && firstVariantPrice && firstVariantWeight > 0) {
      const modifier = parseFloat(firstVariantPrice) / firstVariantWeight;
      modifierDisplay = `${modifier.toFixed(2)}`;
    }

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
      priceDisplay,
      modifierDisplay
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
                  <InlineStack gap="300" align="space-between">
                    <InlineStack gap="300">
                      <Checkbox
                        label="Select All"
                        checked={selectAll}
                        onChange={handleSelectAll}
                      />
                      <Select
                        label=""
                        labelHidden
                        options={[
                          { label: 'Current Page', value: 'page' },
                          { label: 'Whole Collection', value: 'collection' }
                        ]}
                        value={selectAllMode}
                        onChange={handleSelectAllModeChange}
                        disabled={selectAll}
                      />
                    </InlineStack>
                    <Text variant="bodyMd" as="p">
                      {selectedProducts.size} of {filteredProducts.length} products selected
                    </Text>
                  </InlineStack>

                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text', 'text']}
                    headings={['Select', 'Product Title', 'Status', 'Variants', 'First Variant Weight', 'First Variant Price', 'Current Modifier']}
                    rows={tableRows}
                    hoverable
                    pagination={{
                      hasNext: currentPage < totalPages,
                      hasPrevious: currentPage > 1,
                      onNext: () => setCurrentPage(currentPage + 1),
                      onPrevious: () => setCurrentPage(currentPage - 1),
                    }}
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