sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, Fragment, MessageBox, Filter, FilterOperator) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.CustomerSearch", {
    onInit: function () {
      var oSearchCriteriaModel = new JSONModel({
        customerName: "Mokoena",
        mobile: "",
        email: ""
      });
      this.getView().setModel(oSearchCriteriaModel, "searchCriteria");

      var oRouter = this.getRouter();
      oRouter.getRoute("customerSearch").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 1);
    },

    onSearchCustomer: function () {
      var oCriteria = this.getView().getModel("searchCriteria").getData();
      var sName = (oCriteria.customerName || "").trim();
      var sMobile = (oCriteria.mobile || "").trim();
      var sEmail = (oCriteria.email || "").trim();

      // No validation required: if no criteria provided, display all data
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/searchCriteriaUsed", {
        customerName: sName,
        mobile: sMobile,
        email: sEmail
      });
      oAppState.setProperty("/searchFilterValue", sName);

      this._openSearchResultsDialog(sName);
    },

    _openSearchResultsDialog: function (sFilter) {
      var oView = this.getView();
      var that = this;

      if (!this._pResultsDialog) {
        this._pResultsDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.CustomerSearchResultsDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pResultsDialog.then(function (oDialog) {
        // Pre-select first item
        var oTable = Fragment.byId(oView.getId(), "customerResultsTable");
        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          oTable.setSelectedItem(aItems[0]);
          that._selectedCustomerContext = aItems[0].getBindingContext("customers");
        }
        oDialog.open();
      });
    },

    onSelectCustomerRow: function (oEvent) {
      var oListItem = oEvent.getParameter("listItem");
      this._selectedCustomerContext = oListItem.getBindingContext("customers");
    },

    onLiveSearchDialog: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
      var oBinding = oTable.getBinding("items");

      if (sValue) {
        var aFilters = [
          new Filter("name", FilterOperator.Contains, sValue),
          new Filter("bpNumber", FilterOperator.Contains, sValue),
          new Filter("telephone", FilterOperator.Contains, sValue),
          new Filter("email", FilterOperator.Contains, sValue)
        ];
        oBinding.filter(new Filter({ filters: aFilters, and: false }));
      } else {
        oBinding.filter([]);
      }
    },

    onConfirmCustomerSelection: function () {
      if (!this._selectedCustomerContext) {
        var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          this._selectedCustomerContext = aItems[0].getBindingContext("customers");
        }
      }

      if (this._selectedCustomerContext) {
        var oCustomerData = this._selectedCustomerContext.getObject();
        var oAppState = this.getModel("appState");
        // Deep copy customer data
        oAppState.setProperty("/customer", JSON.parse(JSON.stringify(oCustomerData)));
        oAppState.setProperty("/orderHeader/soldToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/orderHeader/shipToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/delivery/address", oCustomerData.address);
      }

      this.onCloseSearchResultsDialog();
      this.navTo("basicDetails");
    },

    onCustomerNotFound: function () {
      this.onCloseSearchResultsDialog();
      this.navTo("customerCreate");
    },

    onCloseSearchResultsDialog: function () {
      if (this._pResultsDialog) {
        this._pResultsDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    onClearCriteria: function () {
      this.getView().getModel("searchCriteria").setData({
        customerName: "",
        mobile: "",
        email: ""
      });
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
