import java.io.*;

public class email {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new FileReader(new File("./info.txt")));
        BufferedWriter bw = new BufferedWriter(new FileWriter(new File("./email.txt")));
        while (true) {
            String s = br.readLine();
            if (s == null)
                break;
            String str1;
            String str2;
            if (!s.contains(" ")) {
                str1 = s.toLowerCase().replaceAll("-", "");
                str2 = "";
            } else {
                str1 = s.substring(0, s.indexOf(" ")).toLowerCase().replaceAll(" ", "").replaceAll("-", "");
                str2 = s.substring(s.indexOf(" ") + 1).toLowerCase();
                str2 = str2.replaceAll(" ", "");
                str2 = "." + str2.replaceAll("-", "");
            }
            String updateStatement = "UPDATE BUS_COMPANY SET EMAIL='" + str1 + str2 + "@gmail.com' WHERE BUS_COMPANY_NAME='"
                    + s + "';";
            bw.write(updateStatement);
            bw.newLine();
        }
        bw.close();
        br.close();
    }
}
