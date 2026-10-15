sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.CustomerCreate", {
    onInit: function () {
      var oModel = new JSONModel({
        selectedTypeIndex: 0,
        customerType: "Individual"
      });
      this.getView().setModel(oModel, "customerCreateModel");

      var oRouter = this.getRouter();
      oRouter.getRoute("customerCreate").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 1);
    },

    onCustomerTypeChange: function (oEvent) {
      var nIndex = oEvent.getParameter("selectedIndex");
      var sType = nIndex === 1 ? "Company" : "Individual";
      var oModel = this.getView().getModel("customerCreateModel");
      oModel.setProperty("/selectedTypeIndex", nIndex);
      oModel.setProperty("/customerType", sType);
    },

    onContinueWithShellCustomer: function () {
      var oAppState = this.getModel("appState");
      var oCreateModel = this.getView().getModel("customerCreateModel");
      var sType = oCreateModel.getProperty("/customerType");
      var oCriteria = oAppState.getProperty("/searchCriteriaUsed") || {};

      var sShellBp = "10002" + Math.floor(10000 + Math.random() * 90000);
      var sName = oCriteria.customerName || (sType === "Company" ? "New Enterprise Ltd" : "New Customer");

      var oNewCustomer = {
        bpNumber: sShellBp,
        name: sName,
        firstName: sType === "Individual" ? (sName.split(" ")[0] || "") : "",
        lastName: sType === "Individual" ? (sName.split(" ")[1] || "") : "",
        title: sType === "Individual" ? "Mr" : "",
        telephone: oCriteria.mobile || "",
        email: oCriteria.email || "",
        type: sType,
        idPassport: "",
        companyName: sType === "Company" ? sName : "",
        regNo: sType === "Company" ? "2026/001928/07" : "",
        vatNo: sType === "Company" ? "4990192837" : "",
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
          formatted: "",
          type: "Default / Billing",
          status: "NEW",
          statusState: "Information"
        }
      };

      oAppState.setProperty("/customer", oNewCustomer);
      oAppState.setProperty("/orderHeader/soldToParty", sShellBp + " - " + sName);
      oAppState.setProperty("/orderHeader/shipToParty", sShellBp + " - " + sName);

      MessageToast.show("Shell BP " + sShellBp + " created via CRM API");
      this.navTo("basicDetails");
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
