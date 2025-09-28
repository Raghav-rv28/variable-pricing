import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Checkbox,
  Divider,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useState } from "react";

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = "admin.order-details.print-action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n and data.
  const {i18n, data} = useApi(TARGET);
  const [src, setSrc] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState({
    invoice: false,
    appraisal: false,
    delivery: false
  });
 
  // data has information about the resource to be printed.
  console.log({ data });

  // Build the print URL based on selected documents
  useEffect(() => {
    if (data?.selected?.[0]?.id) {
      const selectedTypes = Object.entries(selectedDocuments)
        .filter(([_, isSelected]) => isSelected)
        .map(([type, _]) => type);

      if (selectedTypes.length > 0) {
        const params = new URLSearchParams({
          orderId: data.selected[0].id,
          documents: selectedTypes.join(',')
        });
        
        const fullSrc = `/print?${params.toString()}`;
        setSrc(fullSrc);
      } else {
        setSrc(null);
      }
    } else {
      setSrc(null);
    }
  }, [data?.selected, selectedDocuments]);

  const handleDocumentChange = (documentType, isChecked) => {
    setSelectedDocuments(prev => ({
      ...prev,
      [documentType]: isChecked
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedDocuments).every(val => val);
    const newState = {
      invoice: !allSelected,
      appraisal: !allSelected,
      delivery: !allSelected
    };
    setSelectedDocuments(newState);
  };

  const handleClearAll = () => {
    setSelectedDocuments({
      invoice: false,
      appraisal: false,
      delivery: false
    });
  };

  const selectedCount = Object.values(selectedDocuments).filter(Boolean).length;
  const hasSelection = selectedCount > 0;
  const allSelected = Object.values(selectedDocuments).every(val => val);

  return (
    <AdminPrintAction src={src}>
      <BlockStack blockGap="base">
        {!data?.selected?.[0]?.id && (
          <Banner tone="critical" title="No Order Selected">
            Please select an order to print documents for.
          </Banner>
        )}
       
        {data?.selected?.[0]?.id && (
          <>
            <Text fontWeight="bold">Select Documents to Print</Text>
            
            <Text tone="subdued" size="small">
              Choose which documents you want to print for order {data.selected[0].name || data.selected[0].id}
            </Text>
            
            <BlockStack blockGap="tight">
              <Checkbox
                id="invoice"
                checked={selectedDocuments.invoice}
                onChange={(isChecked) => handleDocumentChange('invoice', isChecked)}
              >
                <Text>Invoice - Standard billing document with itemized charges</Text>
              </Checkbox>
              
              <Checkbox
                id="appraisal"
                checked={selectedDocuments.appraisal}
                onChange={(isChecked) => handleDocumentChange('appraisal', isChecked)}
              >
                <Text>Appraisal - Professional valuation with disclaimers</Text>
              </Checkbox>
              
              <Checkbox
                id="delivery"
                checked={selectedDocuments.delivery}
                onChange={(isChecked) => handleDocumentChange('delivery', isChecked)}
              >
                <Text>Delivery Receipt - In-person delivery confirmation with signatures</Text>
              </Checkbox>
            </BlockStack>

            <Divider />

            <InlineStack blockGap="base">
              <Button
                variant="secondary"
                size="small"
                onPress={handleSelectAll}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              
              <Button
                variant="secondary" 
                size="small"
                onPress={handleClearAll}
                disabled={selectedCount === 0}
              >
                Clear Selection
              </Button>
            </InlineStack>

            {hasSelection && (
              <BlockStack blockGap="tight">
                <Text fontWeight="semibold" tone="success">
                  Ready to print {selectedCount} document{selectedCount > 1 ? 's' : ''}:
                </Text>
                <BlockStack blockGap="extraTight">
                  {selectedDocuments.invoice && (
                    <Text size="small" tone="subdued">• Invoice</Text>
                  )}
                  {selectedDocuments.appraisal && (
                    <Text size="small" tone="subdued">• Appraisal</Text>
                  )}
                  {selectedDocuments.delivery && (
                    <Text size="small" tone="subdued">• Delivery Receipt</Text>
                  )}
                </BlockStack>
              </BlockStack>
            )}

            {!hasSelection && (
              <Banner tone="info" title="No Documents Selected">
                Please select at least one document type to enable printing.
              </Banner>
            )}
           
            <Text size="small" tone="subdued">
              Click the print button above to generate your selected documents. Each document will be on a separate page.
            </Text>
          </>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}