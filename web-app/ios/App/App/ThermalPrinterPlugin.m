#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ThermalPrinterPlugin, "ThermalPrinter",
    CAP_PLUGIN_METHOD(printReceipt, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(testPrint, CAPPluginReturnPromise);
)
