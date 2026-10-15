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

      oAppState.setProperty("/cart", aItems);
      oAppState.setProperty("/pricing/netValue", fNetValue);
      oAppState.setProperty("/pricing/discounts", -fDiscountSum);
      oAppState.setProperty("/pricing/vat", fVat);
      oAppState.setProperty("/pricing/total", fTotal);
    },

    /**
     * Address validation plugin helper dialog
     */
    openAddressValidationDialog: function (sAddressType, fnCallback) {
      var oView = this.getView();
      var that = this;

      if (!this._pAddressDialog) {
        this._pAddressDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.AddressValidationDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._fnAddressCallback = fnCallback;
      this._sCurrentAddressType = sAddressType || "Default (Billing)";

      this._pAddressDialog.then(function (oDialog) {
        var oAppState = that.getModel("appState");
        var oCustomer = oAppState.getProperty("/customer");
        oAppState.setProperty("/addressDialogContext", {
          bpNumber: oCustomer.bpNumber || "1000234571",
          addressType: that._sCurrentAddressType,
          searchQuery: ""
        });
        oDialog.open();
      });
    },

    onConfirmAddressDialog: function (oEvent) {
      var oAppState = this.getModel("appState");
      var sSelectedPath = oAppState.getProperty("/selectedAddressPath");
      var oAddressesModel = this.getModel("addresses");
      var oSelectedAddress = null;

      if (sSelectedPath) {
        oSelectedAddress = oAddressesModel.getProperty(sSelectedPath);
      } else {
        // Default to first item
        var aList = oAddressesModel.getData() || [];
        oSelectedAddress = aList[0];
      }

      if (this._pAddressDialog) {
        this._pAddressDialog.then(function (oDialog) {
          oDialog.close();
        });
      }

      if (typeof this._fnAddressCallback === "function") {
        this._fnAddressCallback(oSelectedAddress);
      }
    },

    onCancelAddressDialog: function () {
      if (this._pAddressDialog) {
        this._pAddressDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
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
