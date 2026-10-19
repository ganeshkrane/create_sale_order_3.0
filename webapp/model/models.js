sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/ui/Device"
], function (JSONModel, Device) {
  "use strict";

  return {
    createDeviceModel: function () {
      var oModel = new JSONModel(Device);
      oModel.setDefaultBindingMode("OneWay");
      return oModel;
    },

    createAppStateModel: function () {
      var oInitialState = {
        currentStep: 1,
        // Customer session data (empty initially until selected or created)
        customer: {
          bpNumber: "",
          name: "",
          firstName: "",
          lastName: "",
          title: "Mr.",
          telephone: "",
          email: "",
          type: "Individual",
          dateOfBirth: "",
          gender: "Male",
          idType: "SA ID Number",
          idPassport: "",
          companyName: "",
          regNo: "",
          vatNo: "",
          authRepTitle: "Mr.",
          authRepFirstName: "",
          authRepSurname: "",
          contactPerson: "",
          language: "English",
          salesOrg: "1000",
          distChannel: "10",
          division: "00",
          address: {
            street: "",
            city: "",
            postalCode: "",
            region: "",
            country: "ZA",
            formatted: "",
            type: "Default / Billing",
            status: "",
            statusState: "None"
          }
        },
        // Marketing information (Step 3)
        marketing: {
          marketToYou: "",
          marketingLanguage: "English",
          marketingCorrespondenceMethod: "",
          statementCorrespondenceMethod: "",
          creditBureauCheck: ""
        },
        // Consent preferences
        consent: {
          email: true,
          sms: true,
          phone: false,
          partners: false,
          capturedBy: "GR · 12 Oct 2026 · Store 1042"
        },
        // Order Header
        orderHeader: {
          orderType: "ZOR",
          orderTypeName: "Standard Store Order",
          orderTypeDesc: "ZOR · Take-away / collect today",
          soldToParty: "",
          shipToParty: "",
          customerReference: "REF-STORE-2026-001",
          requestedDeliveryDate: "12 Oct 2026",
          salesOrg: "1000",
          paymentTerms: "Immediate"
        },
        // Cart and items
        cartTab: "sales",
        deliverySchedules: {
          requestedDate: "Sep 28, 2026",
          customerName: "BM1 TEST1"
        },
        conditions: [
          {
            id: "cond-1",
            conditionType: "PR00 - Price",
            amount: "7,499.00",
            per: "1 EA",
            value: "7,499.00 ZAR"
          },
          {
            id: "cond-2",
            conditionType: "K004 - Material Discount",
            amount: "150.00-",
            per: "1 EA",
            value: "150.00- ZAR"
          }
        ],
        cart: [],
        cartCount: 0,
        deliveryValidationNotices: [],
        deliveryValidationPassed: false,
        deliveryValidationNotice: "",
        // Sourcing status summary per SRS V3.3 decision rules
        sourcingSummary: {
          methodKey: "CND",
          totalItems: 0,
          blockingCount: 0,
          actionableCount: 0,
          hasErrors: false,
          statusState: "Success",
          statusTitle: "Delivery Sourcing Ready",
          statusDescription: "Select your preferred delivery method to evaluate inventory sourcing."
        },
        // Pricing summary breakdown
        pricing: {
          netValue: 0.00,
          discounts: 0.00,
          vat: 0.00,
          total: 0.00
        },
        // Delivery choices and address (Review Shipping 23 fields)
        delivery: {
          methodKey: "CND",
          methodTitle: "Delivery (CND)",
          methodSubtitle: "Deliver to customer address",
          // CNC Store Collection Data (from Image 1)
          collectionStore: {
            storeId: "store-centurion",
            storeName: "Centurion Lifestyle Centre",
            address: "Shop 18, Lenchen Ave, Centurion",
            distance: "Available · 4.2 km away"
          },
          collectionStores: [
            {
              storeId: "store-centurion",
              storeName: "Centurion Lifestyle Centre",
              address: "Shop 18, Lenchen Ave, Centurion",
              distance: "Available · 4.2 km away"
            },
            {
              storeId: "store-menlyn",
              storeName: "Menlyn Park Shopping Centre",
              address: "Atterbury Rd & Lois Ave, Menlyn, Pretoria",
              distance: "Available · 6.8 km away"
            },
            {
              storeId: "store-mall-of-africa",
              storeName: "Mall of Africa",
              address: "Magwa Cres, Midrand, Johannesburg",
              distance: "Available · 12.1 km away"
            },
            {
              storeId: "store-sandton-city",
              storeName: "Sandton City Store",
              address: "Rivonia Rd & 5th St, Sandton",
              distance: "Available · 18.4 km away"
            },
            {
              storeId: "store-brooklyn",
              storeName: "Brooklyn Mall",
              address: "Veale St & Fehrsen St, Nieuw Muckleneuk, Pretoria",
              distance: "Available · 7.5 km away"
            }
          ],
          // CNP BOPIS Pickup Point Data (from Image 2)
          pickupPoint: {
            pointId: "pickup-centurion-mall",
            pointName: "Centurion Mall Locker Hub",
            location: "Centurion Mall, Pretoria",
            distance: "Open today · 4.2 km away"
          },
          pickupPoints: [
            {
              pointId: "pickup-centurion-mall",
              pointName: "Centurion Mall Locker Hub",
              location: "Centurion Mall, Pretoria",
              distance: "Open today · 4.2 km away"
            },
            {
              pointId: "pickup-pretoria-east",
              pointName: "Pretoria East Pargo Point",
              location: "Garsfontein Rd, Pretoria East",
              distance: "Open today · 8.1 km away"
            },
            {
              pointId: "pickup-midrand-postnet",
              pointName: "Midrand PostNet Hub",
              location: "Old Pretoria Rd, Midrand",
              distance: "Open today · 11.5 km away"
            },
            {
              pointId: "pickup-rosebank-locker",
              pointName: "Rosebank Station Locker",
              location: "Oxford Rd, Rosebank, Johannesburg",
              distance: "Open today · 21.0 km away"
            },
            {
              pointId: "pickup-hatfield-plaza",
              pointName: "Hatfield Plaza Pickup",
              location: "Burnett St, Hatfield, Pretoria",
              distance: "Open today · 9.3 km away"
            }
          ],
          payee: "1000234571",
          payeeText: "1000234571 - Thabo Mokoena",
          poNumber: "PO-2026-99482",
          deliveryType: "Pick",
          requestedDeliveryDate: "Sep 28, 2026",
          singleShipment: true,
          carrier: "DHL Express",
          shipping: "Standard Delivery",
          incoterms: "FOB - Free on Board",
          sameAsBilling: true,
          shipTo: "1000234571",
          shipToName: "1000234571 - Thabo Mokoena (Primary Store)",
          shipToAddress: {
            street: "12 Rivonia Road",
            city: "Sandton",
            state: "Gauteng",
            postalCode: "2196",
            country: "South Africa",
            phone: "+27 82 555 0192"
          },
          billTo: "1000234571",
          billToName: "1000234571 - Thabo Mokoena",
          billToAddress: {
            street: "12 Rivonia Road",
            city: "Sandton",
            state: "Gauteng",
            postalCode: "2196",
            country: "South Africa",
            phone: "+27 82 555 0192"
          },
          shippingInstructions: "Deliver to front reception between 09:00 - 16:00",
          notesToReceiver: "Call customer upon arrival",
          attachments: [
            {
              AttaId: "test.pdf",
              Descr: "test.pdf",
              id: "test.pdf",
              fileName: "test.pdf",
              name: "test.pdf",
              fileSize: "168.2 KB",
              size: "168.2 KB",
              fileType: "application/pdf",
              uploadDate: "10/14/2026",
              isPdf: true,
              url: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA3Mwo+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGROCihTYWxlcyBPcmRlciBQRC1Db25maXJtYXRpb24gQXR0YWNobWVudCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE5IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAowMDAwMDAwMjQ5IDAwMDAwIG4gCjAwMDAwMDAzNzIgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoxNDU2CiUlRU9G"
            }
          ],
          address: {
            formatted: "12 Rivonia Road, Sandton, 2196, Gauteng",
            status: "EXISTING",
            statusState: "Success"
          },
          differentAddress: {
            formatted: "45 Jan Smuts Avenue, Rosebank, 2196, Gauteng",
            status: "MODIFIED",
            statusState: "Warning",
            note: "Last delivered 02 Aug 2026 · Unit number added"
          },
          oaa: [
            {
              article: "Oslo Dining Chair - Oak",
              requested: 4,
              confirmed: 4,
              earliestDate: "14 Oct 2026",
              statusText: "In store",
              statusState: "Success"
            },
            {
              article: "Nordic Dining Table",
              requested: 1,
              confirmed: 1,
              earliestDate: "16 Oct 2026",
              statusText: "Warehouse - 3 days",
              statusState: "Information"
            }
          ]
        },
        // Final review and created order
        orderFinal: {
          salesOrderNo: "",
          shipToBp: "",
          shipmentPriority: "",
          shipmentPriorityText: "",
          remarks: "",
          isSaved: false
        },
        // Review and Place Order fields matching specification
        review: {
          shippingDetails: {
            shipTo: "1000234571 - Thabo Mokoena",
            payee: "1000234571 - Thabo Mokoena",
            phoneNumber: "+27 82 555 0192",
            requestedDeliveryDate: "Sep 28, 2026",
            singleShipment: "Yes",
            carrier: "DHL Express",
            shipping: "Standard Delivery",
            incoterms: "FOB - Free on Board",
            shippingInstructions: "Deliver to front reception between 09:00 - 16:00",
            notesToReceiver: "Call customer upon arrival"
          },
          billingDetails: {
            billTo: "1000234571 - Thabo Mokoena",
            address: "12 Rivonia Road",
            city: "Sandton",
            state: "Gauteng",
            postalCode: "2196",
            country: "South Africa",
            phoneNumber: "+27 82 555 0192"
          },
          orderDetails: {
            soldTo: "1000234571 - Thabo Mokoena",
            applicationId: "PO-2026-99482",
            salesOrderType: "ZOR - Standard Store Order"
          }
        }
      };

      return new JSONModel(oInitialState);
    }
  };
});
