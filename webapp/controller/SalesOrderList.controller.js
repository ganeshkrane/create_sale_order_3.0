sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/salesorder/store/model/formatter",
  "sap/m/MessageToast"
], function (BaseController, Filter, FilterOperator, formatter, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.SalesOrderList", {
    formatter: formatter,

    onInit: function () {
      var oRouter = this.getRouter();
      if (oRouter) {
        oRouter.getRoute("salesOrderList").attachPatternMatched(this._onRouteMatched, this);
      }
    },

    _onRouteMatched: function () {
      this._reloadOrders();
    },

    _reloadOrders: function () {
      var oSalesOrdersModel = this.getOwnerComponent().getModel("salesOrders");
      if (oSalesOrdersModel) {
        try {
          var sStored = localStorage.getItem("sap_sales_orders_store");
          if (sStored) {
            var aOrders = JSON.parse(sStored);
            oSalesOrdersModel.setProperty("/orders", aOrders);
          }
        } catch (e) {
          // ignore
        }
        this.onApplyFilters();
      }
    },

    onRefreshPress: function () {
      this._reloadOrders();
      MessageToast.show("Sales orders refreshed");
    },

    onCreateSalesOrderPress: function () {
      this.getRouter().navTo("customerWizard");
    },

    onApplyFilters: function () {
      var oModel = this.getOwnerComponent().getModel("salesOrders");
      if (!oModel) return;

      var aOrders = oModel.getProperty("/orders") || [];
      var oFilters = oModel.getProperty("/filters") || {};

      var sSearch = (oFilters.searchQuery || "").trim().toLowerCase();
      var sOrderType = oFilters.orderType || "";
      var sTvLicense = oFilters.tvLicenseType || "";
      var sDelivery = oFilters.deliveryMethod || "";
      var sStatus = oFilters.status || "";

      var aFiltered = aOrders.filter(function (order) {
        if (sSearch) {
          var sNo = (order.salesOrderNo || "").toLowerCase();
          var sCust = (order.customerName || "").toLowerCase();
          var sBp = (order.customerBp || "").toLowerCase();
          var sPo = (order.poNumber || "").toLowerCase();
          if (sNo.indexOf(sSearch) === -1 &&
              sCust.indexOf(sSearch) === -1 &&
              sBp.indexOf(sSearch) === -1 &&
              sPo.indexOf(sSearch) === -1) {
            return false;
          }
        }

        if (sOrderType && order.orderType !== sOrderType) {
          return false;
        }

        if (sTvLicense && order.tvLicenseType !== sTvLicense) {
          return false;
        }

        if (sDelivery && order.deliveryMethod !== sDelivery) {
          return false;
        }

        if (sStatus && order.status !== sStatus) {
          return false;
        }

        return true;
      });

      oModel.setProperty("/filteredOrders", aFiltered);
    },

    onClearFilters: function () {
      var oModel = this.getOwnerComponent().getModel("salesOrders");
      if (oModel) {
        oModel.setProperty("/filters", {
          searchQuery: "",
          orderType: "",
          tvLicenseType: "",
          deliveryMethod: "",
          status: ""
        });
        var aOrders = oModel.getProperty("/orders") || [];
        oModel.setProperty("/filteredOrders", aOrders);
      }
      MessageToast.show("Filters cleared");
    },

    onOrderRowPress: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("salesOrders");
      if (!oContext) return;

      var oOrder = oContext.getObject();
      if (oOrder && oOrder.salesOrderNo) {
        this.getRouter().navTo("salesOrderDetail", {
          orderId: oOrder.salesOrderNo
        });
      }
    }
  });
});
