sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/salesorder/store/model/formatter",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, formatter, History, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.SalesOrderDetail", {
    formatter: formatter,

    onInit: function () {
      var oRouter = this.getRouter();
      if (oRouter) {
        oRouter.getRoute("salesOrderDetail").attachPatternMatched(this._onRouteMatched, this);
      }
    },

    _onRouteMatched: function (oEvent) {
      var sOrderId = oEvent.getParameter("arguments").orderId;
      this._loadOrderDetail(sOrderId);
    },

    _loadOrderDetail: function (sOrderId) {
      var oSalesOrdersModel = this.getOwnerComponent().getModel("salesOrders");
      var aOrders = (oSalesOrdersModel && oSalesOrdersModel.getProperty("/orders")) || [];

      if (!aOrders || aOrders.length === 0) {
        try {
          var sStored = localStorage.getItem("sap_sales_orders_store");
          if (sStored) {
            aOrders = JSON.parse(sStored);
          }
        } catch (e) {
          // ignore
        }
      }

      var oOrder = (aOrders || []).find(function (ord) {
        return String(ord.salesOrderNo) === String(sOrderId);
      });

      if (oOrder) {
        this.getView().setModel(new JSONModel(oOrder), "selectedOrder");
      } else {
        // Fallback fetch if model was not yet loaded
        var sUrl = sap.ui.require.toUrl("sap/ui/salesorder/store/model/mockdata/salesOrders.json");
        fetch(sUrl)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var found = (data || []).find(function (ord) {
              return String(ord.salesOrderNo) === String(sOrderId);
            }) || (data && data[0]);

            if (found) {
              this.getView().setModel(new JSONModel(found), "selectedOrder");
            }
          }.bind(this))
          .catch(function () {});
      }
    },

    onNavBack: function () {
      var oRouter = this.getRouter();
      if (oRouter) {
        oRouter.navTo("salesOrderList");
      } else {
        window.history.back();
      }
    },

    onCreateNewOrder: function () {
      this.getRouter().navTo("customerWizard");
    }
  });
});
