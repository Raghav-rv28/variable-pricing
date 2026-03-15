import {useEffect, useMemo, useState} from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Divider,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-details.action.render';

type OrderDetails = {
  id: string;
  name: string;
  customerFirstName: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  email: string | null;
};

type ShopifyOrderResponse = {
  data?: {
    order?: {
      id: string;
      name: string;
      customer?: {
        firstName?: string | null;
        phone?: string | null;
        email?: string | null;
        defaultAddress?: {
          phone?: string | null;
        } | null;
      } | null;
      shippingAddress?: {
        phone?: string | null;
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        province?: string | null;
        country?: string | null;
        zip?: string | null;
      } | null;
    } | null;
  };
  errors?: Array<{message?: string}>;
};

const MESSAGE_TEMPLATES = [
  {
    id: 'thank-you',
    label: 'Order confirmation',
    buildMessage: ({customerFirstName, orderName, addressLine1, addressLine2, city, state, zip, country, email, phone}: MessageContext) =>
      `Hi ${customerFirstName}, thank you for your order ${orderName}. We are reaching out to you to confirm your details before we ship your order. if you can please confirm the details below. \n\nAddress: ${addressLine1} ${addressLine2} ${city} ${state} ${zip} ${country} \n\n and Contact Information: \n ${email} \n ${phone} \n\n Once confirmed, we will share the video of the product(s) you have ordered and then they will be shipped to you. \n
     `
  },
  {
    id: 'verification-required',
    label: 'Verification required',
    buildMessage: ({orderName}: MessageContext) =>
      `Your order ${orderName} has been flagged for verification. Please send us a picture of your ID holding it in your hand. like shown in the link below. \n https://www.dubaijewellers.com/policies/terms-of-service
     `
  },
  {
    id: "pickup-verification",
    label: 'Pickup verification',
    buildMessage: ({customerFirstName, orderName}: MessageContext) =>
      `Hi, ${customerFirstName}, your order ${orderName} is ready for pickup. Please let us know when you plan to collect it.
    \n please bring your ID with you for pickup, otherwise we will not be able to process your pickup. \n
    if you have any questions, please let us know.
     `
  }
];

type MessageContext = {
  customerFirstName: string;
  orderName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
};

export default reactExtension(TARGET, () => <App />);

function App() {
  const {close, data, query} = useApi(TARGET);
  const orderId = data?.selected?.[0]?.id;
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      setOrderDetails(null);
      setError('No order was selected.');
      return;
    }

    let isCancelled = false;

    async function loadOrder() {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await query<ShopifyOrderResponse['data'], {id: string}>(
          `query OrderForWhatsapp($id: ID!) {
            order(id: $id) {
              id
              name
              customer {
                firstName
                phone
                email
                defaultAddress {
                  phone
                }
              }
              shippingAddress {
                phone
                address1
                address2
                city
                province
                country
                zip
              }
            }
          }`,
          {
            variables: {id: orderId},
          },
        );

        const graphqlError = payload.errors?.find((entry) => entry.message)?.message;

        if (graphqlError) {
          throw new Error(graphqlError);
        }

        const order = payload.data?.order;

        if (!order) {
          throw new Error(
            `Shopify returned no order for selected id: ${orderId}`,
          );
        }

        if (isCancelled) {
          return;
        }

        setOrderDetails({
          id: order.id,
          name: order.name,
          customerFirstName: getCustomerFirstName(order.customer?.firstName),
          phone:
            order.customer?.phone ??
            order.shippingAddress?.phone ??
            order.customer?.defaultAddress?.phone ??
            null,
          addressLine1: order.shippingAddress?.address1 ?? null,
          addressLine2: order.shippingAddress?.address2 ?? null,
          city: order.shippingAddress?.city ?? null,
          state: order.shippingAddress?.province ?? null,
          zip: order.shippingAddress?.zip ?? null,
          country: order.shippingAddress?.country ?? null,
          email: order.customer?.email ?? null,
        });
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }

        setOrderDetails(null);
        setError(getErrorMessage(caughtError));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [orderId]);

  const whatsappPhone = useMemo(
    () => normalizePhoneNumber(orderDetails?.phone),
    [orderDetails?.phone],
  );

  const messageLinks = useMemo(() => {
    if (!orderDetails || !whatsappPhone) {
      return [];
    }

    return MESSAGE_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      message: template.buildMessage({
        customerFirstName: orderDetails.customerFirstName,
        orderName: orderDetails.name,
        addressLine1: orderDetails.addressLine1,
        addressLine2: orderDetails.addressLine2,
        city: orderDetails.city,
        state: orderDetails.state,
        zip: orderDetails.zip,
        country: orderDetails.country,
        email: orderDetails.email,
        phone: orderDetails.phone,
      }),
      href: createWhatsAppLink(
        whatsappPhone,
        template.buildMessage({
          customerFirstName: orderDetails.customerFirstName,
          orderName: orderDetails.name,
          addressLine1: orderDetails.addressLine1,
          addressLine2: orderDetails.addressLine2,
          city: orderDetails.city,
          state: orderDetails.state,
          zip: orderDetails.zip,
          country: orderDetails.country,
          email: orderDetails.email,
          phone: orderDetails.phone,
        }),
      ),
    }));
  }, [orderDetails, whatsappPhone]);

  return (
    <AdminAction
      secondaryAction={
        <Button onPress={close}>
          Close
        </Button>
      }
    >
      <BlockStack blockGap="base">
        {isLoading ? <Text>Loading order details...</Text> : null}

        {!isLoading && error ? <Text>{error}</Text> : null}

        {!isLoading && orderDetails ? (
          <BlockStack blockGap="none">
            <Text>Order: {orderDetails.name}</Text>
            <Text>Customer: {orderDetails.customerFirstName}</Text>
            {orderDetails.phone ? (
              <Text>Using phone: {orderDetails.phone}</Text>
            ) : (
              <Text>
                No phone number was found on the customer or shipping address.
              </Text>
            )}
          </BlockStack>
        ) : null}

        {!isLoading && orderDetails && whatsappPhone ? (
          <BlockStack blockGap="base">
            {messageLinks.map((template) => (
              <BlockStack key={template.id} blockGap="base">
                <Text>{template.label}</Text>
                <Text>{template.message}</Text>
                <Button href={template.href} target="_blank">
                  Open in WhatsApp
                </Button>
                <Divider />
              </BlockStack>
            ))}
          </BlockStack>
        ) : null}
      </BlockStack>
    </AdminAction>
  );
}

function getCustomerFirstName(firstName?: string | null) {
  return firstName?.trim() || 'Customer';
}

function normalizePhoneNumber(phone?: string | null) {
  if (!phone) {
    return null;
  }

  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  if (digitsOnly.startsWith('00')) {
    return digitsOnly.slice(2);
  }

  return digitsOnly;
}

function createWhatsAppLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong while loading order details.';
}