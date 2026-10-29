sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast",
  "sap/ui/salesorder/store/model/formatter"
], function (Controller, History, Fragment, MessageToast, formatter) {
  "use strict";

  return Controller.extend("sap.ui.salesorder.store.controller.BaseController", {
    formatter: formatter,

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },

    getModel: function (sName) {
      return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
    },

    setModel: function (oModel, sName) {
      return this.getView().setModel(oModel, sName);
    },

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    getText: function (sKey, aArgs) {
      return this.getResourceBundle().getText(sKey, aArgs);
    },

    navTo: function (sName, oParameters, bReplace) {
      this.getRouter().navTo(sName, oParameters, bReplace);
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getRouter().navTo("launchpad", {}, true);
      }
    },

    /**
     * Recalculate totals in appState model
     */
    recalculateTotals: function () {
      var oAppState = this.getModel("appState");
      var aItems = oAppState.getProperty("/cart") || [];
      var fGrossSum = 0;
      var fDiscountSum = 0;

      aItems.forEach(function (item) {
        var fLineGross = (item.qty || 1) * (item.netPrice || 0);
        var fLineDiscount = 0;
        if (item.discountPct > 0) {
          fLineDiscount = fLineGross * (item.discountPct / 100);
        }
        item.netValue = +(fLineGross - fLineDiscount).toFixed(2);
        item.targetQty = item.qty;
        item.pricePerUnit = item.netPrice;
        item.itemPrice = item.netValue;
        fGrossSum += fLineGross;
        fDiscountSum += fLineDiscount;
      });

      var fNetValue = +(fGrossSum - fDiscountSum).toFixed(2);
      var fVat = +(fNetValue * 0.15).toFixed(2);
      var fTotal = +(fNetValue + fVat).toFixed(2);

      oAppState.setProperty("/cart", aItems.slice());
      oAppState.setProperty("/cartCount", aItems.length);
      oAppState.setProperty("/pricing/netValue", fNetValue);
      oAppState.setProperty("/pricing/discounts", -fDiscountSum);
      oAppState.setProperty("/pricing/vat", fVat);
      oAppState.setProperty("/pricing/total", fTotal);
      oAppState.refresh(true);
    },

    /**
     * Map internal application address object to the external plugin's address contract
     */
    _mapToPluginAddress: function (oAddr, sAddressType) {
      if (!oAddr) {
        return null;
      }
      var sStreetNumber = oAddr.streetNumber || "";
      var sStreetName = oAddr.streetName || "";
      if (!sStreetNumber && oAddr.street) {
        var match = (oAddr.street + "").match(/^(\d+[\w-]*)\s+(.*)$/);
        if (match) {
          sStreetNumber = match[1];
          sStreetName = match[2];
        } else {
          sStreetName = oAddr.street;
        }
      }

      return {
        addressType: sAddressType,
        dwellingType: oAddr.dwellingType || "HOUSE",
        addressLabel: oAddr.addressLabel || "",
        businessName: oAddr.businessName || "",
        suiteFloor: oAddr.suiteFloor || "",
        unitNumber: oAddr.unitNumber || "",
        building: oAddr.building || "",
        complexName: oAddr.complexName || "",
        streetNumber: sStreetNumber || "",
        streetName: sStreetName || "",
        suburb: oAddr.suburb || oAddr.city || "",
        city: oAddr.city || "",
        province: oAddr.province || oAddr.region || "WC",
        postalCode: oAddr.postalCode || "",
        country: oAddr.country || "ZA",
        latitude: oAddr.latitude || "-33.9253",
        longitude: oAddr.longitude || "18.4239",
        alternativeNumber: oAddr.alternativeNumber || ""
      };
    },

    /**
     * Map external plugin response to internal address state format
     */
    _mapFromPluginResponse: function (response) {
      if (!response) {
        return null;
      }
      var oAddr = response.address || {};
      var aFormattedParts = [];
      if (oAddr.businessName) {
        aFormattedParts.push(oAddr.businessName);
      }
      var sUnitComplex = [oAddr.unitNumber, oAddr.complexName || oAddr.building].filter(Boolean).join(" ");
      if (sUnitComplex) {
        aFormattedParts.push(sUnitComplex);
      }
      if (oAddr.suiteFloor) {
        aFormattedParts.push("Floor " + oAddr.suiteFloor);
      }
      var sStreet = [oAddr.streetNumber, oAddr.streetName].filter(Boolean).join(" ");
      if (sStreet) {
        aFormattedParts.push(sStreet);
      }
      if (oAddr.suburb) {
        aFormattedParts.push(oAddr.suburb);
      }
      var sCityProvZip = [oAddr.city, oAddr.province, oAddr.postalCode].filter(Boolean).join(", ");
      if (sCityProvZip) {
        aFormattedParts.push(sCityProvZip);
      }
      var sFormatted = aFormattedParts.join(", ") || (sStreet + ", " + (oAddr.city || "") + " " + (oAddr.postalCode || ""));

      var sIndicator = response.indicator || "EXISTING";
      var sState = "Success";
      if (sIndicator === "NEW") {
        sState = "Information";
      } else if (sIndicator === "MODIFIED") {
        sState = "Warning";
      }

      return {
        street: sStreet,
        streetNumber: oAddr.streetNumber || "",
        streetName: oAddr.streetName || "",
        businessName: oAddr.businessName || "",
        unitNumber: oAddr.unitNumber || "",
        building: oAddr.building || "",
        complexName: oAddr.complexName || "",
        suiteFloor: oAddr.suiteFloor || "",
        suburb: oAddr.suburb || "",
        city: oAddr.city || "",
        region: oAddr.province || "",
        province: oAddr.province || "",
        postalCode: oAddr.postalCode || "",
        country: oAddr.country || "ZA",
        dwellingType: oAddr.dwellingType || "HOUSE",
        latitude: oAddr.latitude || "",
        longitude: oAddr.longitude || "",
        formatted: sFormatted,
        status: sIndicator,
        statusText: sIndicator,
        statusState: sState,
        deliveryPartner: response.deliveryPartner || null,
        order: response.order || null,
        score: response.score || null,
        scoreString: response.score ? response.score.scoreString : "",
        capturedAt: response.capturedAt || "",
        rawCaptureResponse: response
      };
    },

    /**
     * Address validation plugin helper dialog
     * Integrates external @pepkor-lifestyle/address-capture modal plugin
     */
    openAddressValidationDialog: function (sAddressType, fnCallback, oCustomParams) {
      var that = this;
      var oAppState = this.getModel("appState");
      var oCustomer = (oAppState && oAppState.getProperty("/customer")) || {};
      var oWizardModel = this.getView() && this.getView().getModel("wizardModel");
      var bIsNewCustomer = (oWizardModel && oWizardModel.getProperty("/isCreatingNewCustomer")) ||
                           (oCustomParams && oCustomParams.isNewCustomer);

      // 1. Determine addressType ("DEFAULT" or "DELIVERY")
      var sNormType = "DELIVERY";
      var sLowerType = (sAddressType || "").toLowerCase();
      if (sLowerType.indexOf("billing") !== -1 || sLowerType.indexOf("default") !== -1) {
        sNormType = "DEFAULT";
      }

      // 2. Determine partner
      // As per Fiori Integration Guide Scenario 1a: for new customer, partner is null
      var sPartner = null;
      if (bIsNewCustomer) {
        sPartner = null;
      } else if (oCustomParams && oCustomParams.partner !== undefined) {
        sPartner = oCustomParams.partner;
      } else {
        sPartner = oCustomer.bpNumber || null;
      }

      // 3. Determine deliveryPartner
      // As per Fiori Integration Guide Scenario 1a & 1b: deliveryPartner is null
      var sDeliveryPartner = null;
      if (bIsNewCustomer || sNormType === "DEFAULT") {
        sDeliveryPartner = null;
      } else if (oCustomParams && oCustomParams.deliveryPartner !== undefined) {
        sDeliveryPartner = oCustomParams.deliveryPartner;
      } else if (sNormType === "DELIVERY") {
        sDeliveryPartner = (oAppState && oAppState.getProperty("/delivery/deliveryPartner")) || null;
      }

      // 4. Determine address passed in
      // As per Fiori Integration Guide Scenario 1a: for new customer, address is null
      var oPassAddress = null;
      if (bIsNewCustomer) {
        oPassAddress = null;
      } else if (oCustomParams && oCustomParams.address !== undefined) {
        oPassAddress = oCustomParams.address;
      } else if (sNormType === "DEFAULT") {
        var oCustAddr = oCustomer.address;
        if (oCustAddr && (oCustAddr.street || oCustAddr.formatted)) {
          oPassAddress = oCustAddr;
        }
      } else {
        // Delivery
        var oDelAddr = oAppState && (oAppState.getProperty("/delivery/differentAddress") || oAppState.getProperty("/delivery/deliveryAddress"));
        if (oDelAddr && (oDelAddr.street || oDelAddr.formatted)) {
          oPassAddress = oDelAddr;
        }
      }

      var oFormattedAddressPayload = oPassAddress ? this._mapToPluginAddress(oPassAddress, sNormType) : null;

      var oRequest = {
        partner: sPartner,
        deliveryPartner: sDeliveryPartner,
        addressType: sNormType,
        address: oFormattedAddressPayload,
        display: "modal"
      };

      var oConfig = {
        google: {
          apiKey: "DEMO_MAPS_KEY",
          mapId: "79af1c2c1b7539a01cf87bb2",
          countries: ["ZA"]
        },
        afrigis: {
          baseUrl: "https://afrigis.services"
        },
        endpoints: {
          customerAddresses: "https://api.amperity.pepkor.co.za/addresses"
        },
        auth: {
          afrigis: {
            getToken: function () {
              return Promise.resolve({
                token: "mock-afrigis-token",
                expiresAt: Date.now() + 3600000,
                apiKey: "mock-afrigis-api-key"
              });
            }
          }
        },
        features: {
          weekendDelivery: true
        },
        request: oRequest
      };

      var fnMount = function () {
        if (!window.PLAddressCapture || typeof window.PLAddressCapture.mount !== "function") {
          console.error("PLAddressCapture library is not loaded on window.");
          MessageToast.show("Address Capture plugin failed to load");
          return;
        }

        // 1. Somewhere to mount. For a modal, an empty element on the page is enough;
        //    the library draws its own overlay.
        var host = document.createElement("div");
        host.className = "plac-container-host";
        document.body.appendChild(host);

        var instance = null;

        var fnCleanup = function () {
          if (instance && typeof instance.destroy === "function") {
            try {
              instance.destroy();
            } catch (err) {
              console.warn("Error destroying PLAddressCapture instance", err);
            }
          }
          if (host && host.parentNode) {
            host.parentNode.removeChild(host);
          }
        };

        // 2. Listen before mounting
        host.addEventListener("ac:submit", function (e) {
          var response = e.detail;
          fnCleanup();
          var oMapped = that._mapFromPluginResponse(response);
          if (typeof fnCallback === "function") {
            fnCallback(oMapped, response);
          }
        });

        host.addEventListener("ac:cancel", function () {
          fnCleanup();
          MessageToast.show("Address capture cancelled. Existing address kept.");
        });

        host.addEventListener("ac:error", function (e) {
          console.warn("PLAddressCapture error:", e.detail);
          fnCleanup();
          MessageToast.show("Address capture error: " + (e.detail && e.detail.message ? e.detail.message : "Validation error"));
        });

        // 3. Mount with config and the request
        try {
          instance = window.PLAddressCapture.mount(host, oConfig);
        } catch (mErr) {
          console.error("Failed to mount PLAddressCapture:", mErr);
          fnCleanup();
          MessageToast.show("Address capture initialization failed");
        }
      };

      if (!window.PLAddressCapture) {
        var sFallbackUrl = "./webapp/lib/address-capture.mock.iife.js";
        var script = document.createElement("script");
        script.src = sFallbackUrl;
        script.onload = fnMount;
        script.onerror = function () {
          console.error("Failed to dynamically load address capture mock script");
          MessageToast.show("Could not load address capture plugin script");
        };
        document.head.appendChild(script);
      } else {
        fnMount();
      }
    },

    onSelectAddressItem: function (oEvent) {
      // Legacy stub
    },

    onConfirmAddressDialog: function (oEvent) {
      // Legacy stub
    },

    onCancelAddressDialog: function () {
      // Legacy stub
    },

    /**
     * Cart Tabs: switch between Sales and Conditions
     */
    onCartTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key") || oEvent.getSource().getSelectedKey();
      this.getModel("appState").setProperty("/cartTab", sKey);
    },

    /**
     * Add new row to Conditions table
     */
    onAddConditionRow: function () {
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.push({
        id: "cond-" + Date.now(),
        conditionType: "",
        amount: "",
        per: "1 EA",
        value: ""
      });
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("New condition row added");
    },

    /**
     * Delete row from Conditions table
     */
    onDeleteConditionRow: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.splice(iIndex, 1);
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("Condition row deleted");
    }
  });
});
