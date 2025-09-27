import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
  Text,
  Button,
  InlineStack,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useState } from "react";

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = "admin.order-details.print-action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n and data.
  const {i18n, data} = useApi(TARGET);
  const [src, setSrc] = useState(null);
  const [documentType, setDocumentType] = useState('invoice');
  
  // data has information about the resource to be printed.
  console.log({ data });

  // Build the print URL based on selected document type
  useEffect(() => {
    if (data?.selected?.[0]?.id) {
      const params = new URLSearchParams({
        orderId: data.selected[0].id
      });
      
      const route = documentType === 'appraisal' ? '/appraisal' : '/print';
      const fullSrc = `${route}?${params.toString()}`;
      setSrc(fullSrc);
    } else {
      setSrc(null);
    }
  }, [data?.selected, documentType]);

  const handleDocumentTypeChange = (type) => {
    setDocumentType(type);
  };

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
            <Text fontWeight="bold">Select Document Type</Text>
            
            <InlineStack blockGap="base">
              <Button
                variant={documentType === 'invoice' ? 'primary' : 'secondary'}
                onPress={() => handleDocumentTypeChange('invoice')}
              >
                Invoice
              </Button>
              <Button
                variant={documentType === 'appraisal' ? 'primary' : 'secondary'}
                onPress={() => handleDocumentTypeChange('appraisal')}
              >
                Appraisal
              </Button>
            </InlineStack>
            
            <Text>
              {documentType === 'invoice' 
                ? `Click the print button to generate an invoice for order ${data.selected[0].name || data.selected[0].id}`
                : `Click the print button to generate an appraisal for order ${data.selected[0].name || data.selected[0].id}`
              }
            </Text>
          </>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}