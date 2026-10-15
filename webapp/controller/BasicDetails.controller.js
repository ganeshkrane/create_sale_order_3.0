sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment"
], function (BaseController, MessageToast, MessageBox, Fragment) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.BasicDetails", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("basicDetails").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 1);
    },

    onUpdateFullName: function () {
      var oAppState = this.getModel("appState");
      var sFirst = oAppState.getProperty("/customer/firstName") || "";
      var sLast = oAppState.getProperty("/customer/lastName") || "";
      var sFull = (sFirst + " " + sLast).trim();
      oAppState.setProperty("/customer/name", sFull);
      oAppState.setProperty("/orderHeader/soldToParty", oAppState.getProperty("/customer/bpNumber") + " - " + sFull);
    },

    onUpdateCompanyName: function () {
      var oAppState = this.getModel("appState");
      var sCompany = oAppState.getProperty("/customer/companyName") || "";
      oAppState.setProperty("/customer/name", sCompany);
      oAppState.setProperty("/orderHeader/soldToParty", oAppState.getProperty("/customer/bpNumber") + " - " + sCompany);
    },

    onValidateAddressClick: function () {
      var that = this;
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 2);

      this.openAddressValidationDialog("Default (Billing)", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oAddrObj = {
            street: oSelectedAddress.street || "",
            city: oSelectedAddress.city || "",
            postalCode: oSelectedAddress.postalCode || "",
            region: oSelectedAddress.region || "",
            formatted: oSelectedAddress.formatted || "",
            type: "Default / Billing",
            status: oSelectedAddress.status || "EXISTING",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status)
          };
          oAppState.setProperty("/customer/address", oAddrObj);
          oAppState.setProperty("/delivery/address", oAddrObj);
          MessageToast.show("Address validated: " + oAddrObj.status + " status returned from plug-in");
        }
      });
    },

    onSelectAddressItem: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var sPath = oItem.getBindingContext("addresses").getPath();
      this.getModel("appState").setProperty("/selectedAddressPath", sPath);
    },

    onSearchAddressInPlugin: function (oEvent) {
      var sQuery = oEvent.getParameter("query");
      MessageToast.show("Querying Amperity API for: " + (sQuery || "All"));
    },

    onEnterNewAddressInPlugin: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      var oNewAddr = {
        id: "addr-" + (aAddresses.length + 1),
        street: "88 Grayston Drive",
        city: "Sandton",
        postalCode: "2196",
        region: "Gauteng",
        country: "South Africa",
        formatted: "88 Grayston Drive, Sandton, 2196, Gauteng",
        status: "NEW",
        statusState: "Information",
        note: "Newly entered customer address",
        isDefault: true
      };
      aAddresses.unshift(oNewAddr);
      oAddressesModel.setData(aAddresses);
      this.getModel("appState").setProperty("/selectedAddressPath", "/0");
      MessageToast.show("New address entered (Status: NEW)");
    },

    onEditAddressInPlugin: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      if (aAddresses.length > 0) {
        aAddresses[0].street = "12 Rivonia Road, Suite 402";
        aAddresses[0].formatted = "12 Rivonia Road, Suite 402, Sandton, 2196, Gauteng";
        aAddresses[0].status = "MODIFIED";
        aAddresses[0].statusState = "Warning";
        aAddresses[0].note = "Modified by agent: Suite number added";
        oAddressesModel.setData(aAddresses);
        this.getModel("appState").setProperty("/selectedAddressPath", "/0");
        MessageToast.show("Address edited (Status: MODIFIED)");
      }
    },

    onNextToAddressOrConsent: function () {
      var oAppState = this.getModel("appState");
      var oAddr = oAppState.getProperty("/customer/address");
      if (!oAddr || !oAddr.formatted) {
        this.onValidateAddressClick();
        return;
      }
      oAppState.setProperty("/currentStep", 3);
      this.navTo("consent");
    },

    onNavToSearch: function () {
      this.navTo("customerSearch");
    },

    onNavHome: function () {
      this.navTo("launchpad");
    },

    // Step indicators
    onNavToStepLaunchpad: function () { this.navTo("launchpad"); },
    onNavToStep1: function () { this.navTo("customerSearch"); },
    onNavToStep2: function () { this.navTo("basicDetails"); },
    onNavToStep3: function () { this.navTo("consent"); },
    onNavToStep4: function () { this.navTo("orderType"); },
    onNavToStep5: function () { this.navTo("products"); },
    onNavToStep6: function () { this.navTo("deliveryMethod"); },
    onNavToStep7: function () { this.navTo("orderSummary"); },
    onNavToStepFinal: function () { this.navTo("orderFinal"); }
  });
});
